import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import { Pool } from 'pg'
import rateLimit from 'express-rate-limit'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ---------------------------------------------------------------------------
// Configuration — all sourced from environment variables.
// See .env.example for a description of each variable.
// ---------------------------------------------------------------------------
const {
  RINGCENTRAL_JWT,
  RINGCENTRAL_CLIENT_ID,
  RINGCENTRAL_CLIENT_SECRET,
  RINGCENTRAL_FROM_NUMBER,
  // Comma-separated list of allowed frontend origins, e.g.
  // "https://medical-note-tool.onrender.com"
  // Must be set in production when the frontend and API are on different origins.
  // Not required in development because the Vite dev server proxies /api.
  CORS_ORIGIN,
  PORT = '3001',
  DATABASE_URL,
} = process.env

if (process.env.NODE_ENV === 'production' && !DATABASE_URL) {
  throw new Error('DATABASE_URL is required in production.')
}

const RINGCENTRAL_BASE_URL = 'https://platform.ringcentral.com'
const RINGCENTRAL_TOKEN_URL = `${RINGCENTRAL_BASE_URL}/restapi/oauth/token`
const RINGCENTRAL_SMS_URL = `${RINGCENTRAL_BASE_URL}/restapi/v1.0/account/~/extension/~/sms`
const RINGCENTRAL_MESSAGE_STORE_URL = `${RINGCENTRAL_BASE_URL}/restapi/v1.0/account/~/extension/~/message-store`

// ---------------------------------------------------------------------------
// Access-token cache — avoids re-exchanging the JWT on every request.
// The token is invalidated early (60 s before expiry) and also on 401 from
// the RingCentral SMS endpoint.
// ---------------------------------------------------------------------------
interface TokenCache {
  value: string
  expiresAt: number // ms since epoch
}
let tokenCache: TokenCache | null = null

const SMS_STATUSES = ['Consultation Required', 'Notified', '2nd Text Sent', 'Replied Yes', 'Replied 2nd Text', 'Completed Visit', 'Text failed'] as const
const SMS_PRIORITIES = ['High', 'Medium', 'Low'] as const

type SmsStatus = (typeof SMS_STATUSES)[number]
type SmsPriority = (typeof SMS_PRIORITIES)[number]

interface SmsRow {
  id: number
  date: string
  patient: string
  account: string
  prescriber: string
  status: SmsStatus
  priority: SmsPriority
  phone: string
}

const dbPool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
    })
  : null

const isSmsStatus = (value: unknown): value is SmsStatus => typeof value === 'string' && SMS_STATUSES.includes(value as SmsStatus)
const isSmsPriority = (value: unknown): value is SmsPriority => typeof value === 'string' && SMS_PRIORITIES.includes(value as SmsPriority)
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string'
const isIsoDateString = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

const parseSmsRow = (body: unknown): SmsRow | null => {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  if (typeof record.id !== 'number' || !Number.isInteger(record.id) || record.id < 1) return null
  if (!isIsoDateString(record.date)) return null
  if (!isNonEmptyString(record.patient)) return null
  if (!isNonEmptyString(record.account)) return null
  if (!isNonEmptyString(record.prescriber)) return null
  if (!isSmsStatus(record.status)) return null
  if (!isSmsPriority(record.priority)) return null
  if (!isNonEmptyString(record.phone)) return null
  return {
    id: record.id,
    date: record.date,
    patient: record.patient,
    account: record.account,
    prescriber: record.prescriber,
    status: record.status,
    priority: record.priority,
    phone: record.phone,
  }
}

const parseSmsRowUpdate = (body: unknown): Omit<SmsRow, 'id'> | null => {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  if (!isIsoDateString(record.date)) return null
  if (!isNonEmptyString(record.patient)) return null
  if (!isNonEmptyString(record.account)) return null
  if (!isNonEmptyString(record.prescriber)) return null
  if (!isSmsStatus(record.status)) return null
  if (!isSmsPriority(record.priority)) return null
  if (!isNonEmptyString(record.phone)) return null
  return {
    date: record.date,
    patient: record.patient,
    account: record.account,
    prescriber: record.prescriber,
    status: record.status,
    priority: record.priority,
    phone: record.phone,
  }
}

// Normalize a phone number string to E.164 format (+1XXXXXXXXXX for US numbers).
// Returns an empty string if the number cannot be normalized.
const normalizePhoneNumber = (raw: string): string => {
  if (!raw.trim()) return ''
  const normalized = raw.trim().replace(/[^\d+]/g, '')
  if (/^\+1\d{10}$/.test(normalized)) return normalized
  if (/^1\d{10}$/.test(normalized)) return `+${normalized}`
  if (/^\d{10}$/.test(normalized)) return `+1${normalized}`
  return ''
}

const getDatabasePool = (res: express.Response): Pool | null => {
  if (!dbPool) {
    res.status(503).json({ ok: false, error: 'Database is not configured. Set DATABASE_URL.' })
    return null
  }
  return dbPool
}

async function initializeDatabase(): Promise<void> {
  if (!dbPool) return
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS sms_rows (
      id BIGINT PRIMARY KEY,
      date DATE NOT NULL,
      patient TEXT NOT NULL,
      account TEXT NOT NULL,
      prescriber TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      phone TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (status IN ('Consultation Required', 'Notified', '2nd Text Sent', 'Replied Yes', 'Replied 2nd Text', 'Completed Visit', 'Text failed')),
      CHECK (priority IN ('High', 'Medium', 'Low'))
    )
  `)
}

const smsRowsRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Please retry shortly.' },
})

async function fetchAccessToken(): Promise<string> {
  if (!RINGCENTRAL_JWT || !RINGCENTRAL_CLIENT_ID || !RINGCENTRAL_CLIENT_SECRET) {
    throw new Error('Server is missing RingCentral credentials (RINGCENTRAL_JWT / RINGCENTRAL_CLIENT_ID / RINGCENTRAL_CLIENT_SECRET).')
  }

  const basicCredentials = Buffer.from(`${RINGCENTRAL_CLIENT_ID}:${RINGCENTRAL_CLIENT_SECRET}`).toString('base64')

  const response = await fetch(RINGCENTRAL_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + basicCredentials,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: RINGCENTRAL_JWT,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`RingCentral token exchange failed (${response.status}): ${body}`)
  }

  const data = (await response.json()) as Record<string, unknown>
  const accessToken = data.access_token
  const expiresIn = data.expires_in
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new Error('RingCentral token exchange returned an unexpected response: missing access_token.')
  }
  const ttlSeconds = typeof expiresIn === 'number' && expiresIn > 0 ? expiresIn : 3600
  tokenCache = {
    value: accessToken,
    // Cache with a 60-second safety margin before the stated expiry.
    expiresAt: Date.now() + (ttlSeconds - 60) * 1000,
  }
  return tokenCache.value
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.value
  }
  return fetchAccessToken()
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express()

// Apply CORS only when an explicit allowlist is configured. In development the
// Vite proxy forwards /api requests from the frontend so no CORS header is
// required. In production, set CORS_ORIGIN to the deployed frontend URL(s).
console.log('CORS_ORIGIN raw:', CORS_ORIGIN)

if (CORS_ORIGIN) {
  const allowedOrigins = CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  console.log('Allowed CORS origins:', allowedOrigins)
  app.use(
    cors({
      origin: allowedOrigins,
      methods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )
} else {
  // In same-origin (single-service) production deployments CORS_ORIGIN is not
  // needed because the frontend is served by this same process.
  if (process.env.NODE_ENV !== 'production') {
    console.warn('CORS is disabled because CORS_ORIGIN is not set')
  }
}
app.use(express.json())

// Health check — used by Render to confirm the service is running.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/sms-rows', smsRowsRateLimit, async (_req, res) => {
  const pool = getDatabasePool(res)
  if (!pool) return
  try {
    const result = await pool.query<{
      id: string
      date: string
      patient: string
      account: string
      prescriber: string
      status: SmsStatus
      priority: SmsPriority
      phone: string
    }>(
      'SELECT id, date::TEXT AS date, patient, account, prescriber, status, priority, phone FROM sms_rows ORDER BY id ASC',
    )
    const rows: SmsRow[] = result.rows.map((row) => ({
      id: Number(row.id),
      date: row.date,
      patient: row.patient,
      account: row.account,
      prescriber: row.prescriber,
      status: row.status,
      priority: row.priority,
      phone: row.phone,
    }))
    res.json({ ok: true, rows })
  } catch (error) {
    console.error('Failed to load SMS rows:', error)
    res.status(500).json({ ok: false, error: 'Failed to load SMS rows.' })
  }
})

app.post('/api/sms-rows', smsRowsRateLimit, async (req, res) => {
  const pool = getDatabasePool(res)
  if (!pool) return
  const row = parseSmsRow(req.body)
  if (!row) {
    res.status(400).json({ ok: false, error: 'Invalid SMS row payload.' })
    return
  }
  try {
    const result = await pool.query(
      `
        INSERT INTO sms_rows (id, date, patient, account, prescriber, status, priority, phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `,
      [row.id, row.date, row.patient, row.account, row.prescriber, row.status, row.priority, row.phone],
    )
    if (result.rowCount === 0) {
      res.status(409).json({ ok: false, error: `SMS row ${row.id} already exists.` })
      return
    }
    res.status(201).json({ ok: true, row })
  } catch (error) {
    console.error('Failed to create SMS row:', row.id, error)
    res.status(500).json({ ok: false, error: 'Failed to create SMS row.' })
  }
})

app.put('/api/sms-rows/:id', smsRowsRateLimit, async (req, res) => {
  const pool = getDatabasePool(res)
  if (!pool) return
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ ok: false, error: 'Invalid SMS row id.' })
    return
  }
  const row = parseSmsRowUpdate(req.body)
  if (!row) {
    res.status(400).json({ ok: false, error: 'Invalid SMS row payload.' })
    return
  }
  try {
    await pool.query(
      `
        INSERT INTO sms_rows (id, date, patient, account, prescriber, status, priority, phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE
        SET
          date = EXCLUDED.date,
          patient = EXCLUDED.patient,
          account = EXCLUDED.account,
          prescriber = EXCLUDED.prescriber,
          status = EXCLUDED.status,
          priority = EXCLUDED.priority,
          phone = EXCLUDED.phone,
          updated_at = NOW()
        RETURNING id
      `,
      [id, row.date, row.patient, row.account, row.prescriber, row.status, row.priority, row.phone],
    )
    res.json({ ok: true })
  } catch (error) {
    console.error('Failed to update SMS row:', id, error)
    res.status(500).json({ ok: false, error: 'Failed to update SMS row.' })
  }
})

app.delete('/api/sms-rows/:id', smsRowsRateLimit, async (req, res) => {
  const pool = getDatabasePool(res)
  if (!pool) return
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ ok: false, error: 'Invalid SMS row id.' })
    return
  }
  try {
    const result = await pool.query('DELETE FROM sms_rows WHERE id = $1 RETURNING id', [id])
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: `SMS row ${id} was not found.` })
      return
    }
    res.json({ ok: true })
  } catch (error) {
    console.error('Failed to delete SMS row:', id, error)
    res.status(500).json({ ok: false, error: 'Failed to delete SMS row.' })
  }
})

// ---------------------------------------------------------------------------
// POST /api/sms
// Body: { to: string, text: string }
// Exchanges the configured JWT for a RingCentral access token (cached) and
// sends an SMS from the configured RINGCENTRAL_FROM_NUMBER.
// ---------------------------------------------------------------------------
app.post('/api/sms', async (req, res) => {
  const { to, text } = req.body as { to?: string; text?: string }

  if (!to || !text) {
    res.status(400).json({ ok: false, error: 'Missing required fields: to, text.' })
    return
  }

  if (!RINGCENTRAL_FROM_NUMBER) {
    console.error('RINGCENTRAL_FROM_NUMBER is not configured.')
    res.status(500).json({ ok: false, error: 'SMS service is not fully configured. Contact the administrator.' })
    return
  }

  let accessToken: string
  try {
    accessToken = await getAccessToken()
  } catch (err) {
    console.error('Failed to obtain RingCentral access token:', err)
    res.status(500).json({ ok: false, error: 'Unable to authenticate with RingCentral. Check server configuration.' })
    return
  }

  const callSmsEndpoint = (token: string) =>
    fetch(RINGCENTRAL_SMS_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { phoneNumber: RINGCENTRAL_FROM_NUMBER },
        to: [{ phoneNumber: to }],
        text,
      }),
    })

  let smsResponse = await callSmsEndpoint(accessToken)

  // On 401 the cached token may have been externally revoked — clear the
  // cache, fetch a fresh token, and retry once before giving up.
  if (smsResponse.status === 401) {
    tokenCache = null
    try {
      accessToken = await fetchAccessToken()
      smsResponse = await callSmsEndpoint(accessToken)
    } catch (err) {
      console.error('Failed to refresh RingCentral access token after 401:', err)
      res.status(500).json({ ok: false, error: 'Unable to re-authenticate with RingCentral. Check server configuration.' })
      return
    }
  }

  if (smsResponse.ok) {
    res.json({ ok: true })
    return
  }

  const errorBody = await smsResponse.text()
  console.error(`RingCentral SMS error (${smsResponse.status}):`, errorBody)

  if (smsResponse.status === 401) {
    res.status(502).json({ ok: false, error: 'RingCentral authentication failed. Check server credentials.', detail: errorBody })
    return
  }
  if (smsResponse.status === 403) {
    res.status(502).json({
      ok: false,
      error: 'RingCentral denied permission to send from the configured number or extension.',
      detail: errorBody,
    })
    return
  }

  res.status(502).json({
    ok: false,
    error: `RingCentral rejected the message (${smsResponse.status}${smsResponse.statusText ? ' ' + smsResponse.statusText : ''}).`,
    detail: errorBody,
  })
})

// ---------------------------------------------------------------------------
// POST /api/sms-check-replies
// Fetches inbound RingCentral SMS messages (with pagination), identifies phone
// numbers whose message text contains the word "yes", then updates any SMS rows
// currently in status "Notified" whose normalized phone number matches to
// status "Replied Yes".
// ---------------------------------------------------------------------------
app.post('/api/sms-check-replies', smsRowsRateLimit, async (_req, res) => {
  let accessToken: string
  try {
    accessToken = await getAccessToken()
  } catch (err) {
    console.error('Failed to obtain RingCentral access token:', err)
    res.status(500).json({ ok: false, error: 'Unable to authenticate with RingCentral. Check server configuration.' })
    return
  }

  // Fetch a single page, retrying once on 401 with a fresh token.
  const fetchPage = async (url: string): Promise<Response> => {
    let response = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } })
    if (response.status === 401) {
      tokenCache = null
      try {
        accessToken = await fetchAccessToken()
      } catch {
        // Return the original 401 response if re-auth fails
        return response
      }
      response = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } })
    }
    return response
  }

  // Paginate through all inbound SMS messages
  type RcMessage = { from?: { phoneNumber?: string }; subject?: string; text?: string }
  const allMessages: RcMessage[] = []
  let pageUrl: string | null = `${RINGCENTRAL_MESSAGE_STORE_URL}?type=SMS&direction=Inbound&perPage=100`

  while (pageUrl) {
    let response: Response
    try {
      response = await fetchPage(pageUrl)
    } catch (err) {
      console.error('Network error fetching RingCentral message-store:', err)
      break
    }

    if (!response.ok) {
      console.error(`RingCentral message-store error (${response.status})`)
      break
    }

    const json = (await response.json()) as {
      records?: RcMessage[]
      navigation?: { nextPage?: { uri?: string } }
    }

    allMessages.push(...(json.records ?? []))
    const nextUri = json.navigation?.nextPage?.uri
    pageUrl = nextUri ? (nextUri.startsWith('http') ? nextUri : RINGCENTRAL_BASE_URL + nextUri) : null
  }

  // Build a set of normalized phone numbers that replied "yes"
  const yesNumbers = new Set<string>()
  for (const msg of allMessages) {
    const from = normalizePhoneNumber(msg.from?.phoneNumber ?? '')
    if (!from) continue
    const text = ((msg.subject ?? '') + ' ' + (msg.text ?? '')).toLowerCase()
    if (/\byes\b/.test(text)) yesNumbers.add(from)
  }

  if (yesNumbers.size === 0) {
    res.json({ ok: true, updatedCount: 0 })
    return
  }

  const pool = getDatabasePool(res)
  if (!pool) return

  try {
    // Find "Notified" rows whose normalized phone number appears in the yes-set
    const notifiedResult = await pool.query<{ id: string; phone: string }>(
      `SELECT id, phone FROM sms_rows WHERE status = 'Notified'`,
    )

    const idsToUpdate: number[] = []
    for (const row of notifiedResult.rows) {
      const phone = normalizePhoneNumber(row.phone)
      if (phone && yesNumbers.has(phone)) {
        idsToUpdate.push(Number(row.id))
      }
    }

    if (idsToUpdate.length > 0) {
      await pool.query(
        `UPDATE sms_rows SET status = 'Replied Yes', updated_at = NOW() WHERE id = ANY($1)`,
        [idsToUpdate],
      )
    }

    res.json({ ok: true, updatedCount: idsToUpdate.length })
  } catch (error) {
    console.error('Failed to update SMS rows during check-replies:', error)
    res.status(500).json({ ok: false, error: 'Failed to update SMS rows.' })
  }
})

// ---------------------------------------------------------------------------
// Static file serving + SPA fallback (production single-service deployment)
// In production the built frontend lives at apps/medical-note-tool/dist
// relative to the repo root. The compiled API file is at
// apps/api/dist/index.js, so two levels up is the repo root.
// Override with FRONTEND_DIST env var if the layout differs.
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  const frontendDist = process.env.FRONTEND_DIST ?? path.join(__dirname, '../../medical-note-tool/dist')
  const frontendIndexFile = path.join(frontendDist, 'index.html')
  let frontendIndexHtml: string
  try {
    frontendIndexHtml = fs.readFileSync(frontendIndexFile, 'utf8')
  } catch (error) {
    throw new Error(
      `Unable to read frontend index file at ${frontendIndexFile}. Build the frontend first or set FRONTEND_DIST to the correct directory.`,
      { cause: error },
    )
  }
  app.use(express.static(frontendDist))
  // SPA fallback: serve index.html for any non-API route so client-side
  // routing works correctly.
  app.get('*', (_req, res) => {
    res.type('html').send(frontendIndexHtml)
  })
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const port = parseInt(PORT, 10)
async function startServer(): Promise<void> {
  await initializeDatabase()
  app.listen(port, () => {
    console.log(`medical-note-api listening on port ${port}`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
