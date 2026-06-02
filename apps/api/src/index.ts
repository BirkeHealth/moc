import express from 'express'
import cors from 'cors'

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
} = process.env

const RINGCENTRAL_TOKEN_URL = 'https://platform.ringcentral.com/restapi/oauth/token'
const RINGCENTRAL_SMS_URL = 'https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~/sms'

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
      methods: ['POST', 'GET', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )
} else {
  console.warn('CORS is disabled because CORS_ORIGIN is not set')
}
app.use(express.json())

// Health check — used by Render to confirm the service is running.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
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
// Start
// ---------------------------------------------------------------------------
const port = parseInt(PORT, 10)
app.listen(port, () => {
  console.log(`medical-note-api listening on port ${port}`)
})
