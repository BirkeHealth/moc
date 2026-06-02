import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'

type YesNo = '' | 'yes' | 'no'
type ToolSelection = 'medical-note' | 'sms-table' | null

type FormData = {
  patientName: string
  dob: string
  phone: string
  gender: string
  heightFt: string
  heightIn: string
  weight: string
  bmi: string
  allergies: string
  pmh: string
  psh: string
  medications: string
  hasWeightLossProgram: YesNo
  hasGlp1: YesNo
  lastDose: string
  account: string
  prescriber: string
  prescribedMedication: string
  priority: string
}

type SmsStatus =
  | 'Consultation Required'
  | 'Notified'
  | '2nd Text Sent'
  | 'Replied Yes'
  | 'Replied 2nd Text'
  | 'Completed Visit'
  | 'Text failed'
type SmsPriority = 'High' | 'Medium' | 'Low'

type SmsRow = {
  id: number
  date: string
  patient: string
  account: string
  prescriber: string
  status: SmsStatus
  priority: SmsPriority
  phone: string
}

type SmsSendResult =
  | { ok: true }
  | { ok: false; error: string }

const ACCOUNT_OPTIONS = ['DORAL ACUPUNCTURE', 'HELIMEDS', 'PEAKS CURATIVE', 'CLINIC SECRET', 'TRUE LIO', 'WHITECOAT MD']
const PRESCRIBER_OPTIONS = ['ALBERTO NUNEZ PINA', 'YADIRA JEAN-LOUIS', 'LUK JEAN-LOUIS', 'EMILIO LUIS GONZALEZ', 'CHARLES SAROSY', 'ELIAZER MORGAN']
const MEDICATION_OPTIONS = ['OZEMPIC/WAGOVY', 'ZEPBOUND/MONJAURO']
const NOTE_PRIORITY_OPTIONS = ['Normal', 'Rush']
const STATUSES: SmsStatus[] = ['Consultation Required', 'Notified', '2nd Text Sent', 'Replied Yes', 'Replied 2nd Text', 'Completed Visit', 'Text failed']
const PRIORITIES: SmsPriority[] = ['High', 'Medium', 'Low']

const INITIAL_FORM: FormData = {
  patientName: '', dob: '', phone: '', gender: '', heightFt: '', heightIn: '', weight: '', bmi: '', allergies: '', pmh: '', psh: '', medications: '', hasWeightLossProgram: '', hasGlp1: '', lastDose: '', account: '', prescriber: '', prescribedMedication: '', priority: 'Normal',
}

const INITIAL_SMS_ROWS: SmsRow[] = [
  { id: 1, date: '2026-05-28', patient: 'Maria Torres', account: 'ACC-1042', prescriber: 'Dr. Chen', status: 'Consultation Required', priority: 'High', phone: '(305) 555-0182' },
  { id: 2, date: '2026-05-29', patient: 'James Holloway', account: 'ACC-0891', prescriber: 'Dr. Patel', status: 'Completed Visit', priority: 'Low', phone: '(786) 555-0341' },
  { id: 3, date: '2026-05-30', patient: 'Sandra Kim', account: 'ACC-1107', prescriber: 'Dr. Reyes', status: 'Notified', priority: 'Medium', phone: '(954) 555-0029' },
]

const MEDICAL_NOTE_TEMPLATE = `The patient {{PATIENT NAME}} is a {{AGE}} year old {{GENDER}} with a PMH of {{PMH}} seeking care for Weight Loss. Body Mass Index is {{BMI}}. Patient {{HAS_WEIGHT_LOSS_PROGRAM}} tried any weight loss programs. The patient {{HAS_GLP1}} tried any GLP1 medications in the past. The patient’s last dose of GLP1 medication or any weight loss related medication generic or non generic is {{LAST DOSE}}
The patient is interested in GLP-1 RA medications. Denies personal history of type 1 diabetes, pancreatitis, gastroparesis, seizures or glaucoma. Denies personal or family history of Medullary Thyroid Cancer or Multiple Endocrine Neoplasia Type 2.

Past medical history: {{PMH}}.

Past Surgical History: {{PSH}}

Allergies: {{Allergy}}

Medications: {{MEDICATION}}

Vitals:
H: {{HEIGHT}} (in), W: {{WEIGHT}} (lbs), Body Mass Index: {{BMI}}

Physical Exam: telehealth PE Asynchronous
General: Well developed, well nourished.
HEENT: Normocephalic, atraumatic, conjunctiva clear. No rhinorrhea. No obvious masses noted.
Skin: No rashes noted.
Other: The patient was examined via synchronous telemedicine, with its associated limitations.

Assessment: undefined - undefined
Z71.3-Dietary Counseling and Surveillance
Z72.4 -Inappropriate Diet and Eating Habits

Plan:
The patient is a candidate for GLP-1 RA medication. I'm writing a prescription for {{PATIENT NAME}}. We will initiate non-commercial dosing as it has been identified that the patient will see significant benefit from dosing that is not available under brand name {{ZEPBOUND/MONJAURO or OZEMPIC/WAGOVY}}.

Information on risks, benefits, and alternatives to treatment (including possible side effects such as nausea, vomiting, and abdominal pain, rarer side effects including pancreatitis, cholecystitis, kidney injury, hypoglycemia, and potential for malignancy) possibility of treatment failure, and expected duration of therapy which could last several months to several years.

Will aim for no more than 1-2 lbs per week of weight loss and hope to achieve a goal BMI 22-24, will adjust dosing based on response and side effects.

Recommend drinking sufficient water and working on adhering to a balanced diet with appropriate portion control.

Will follow up with patient in 3-4 weeks to assess response and side effects.`

const STATUS_STYLES: Record<SmsStatus, string> = {
  'Consultation Required': 'border-amber-200 bg-amber-50 text-amber-700',
  Notified: 'border-sky-200 bg-sky-50 text-sky-700',
  '2nd Text Sent': 'border-indigo-200 bg-indigo-50 text-indigo-700',
  'Replied Yes': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Replied 2nd Text': 'border-violet-200 bg-violet-50 text-violet-700',
  'Completed Visit': 'border-teal-200 bg-teal-50 text-teal-700',
  'Text failed': 'border-rose-200 bg-rose-50 text-rose-700',
}

const PRIORITY_STYLES: Record<SmsPriority, string> = {
  High: 'border-rose-200 bg-rose-50 text-rose-700',
  Medium: 'border-amber-200 bg-amber-50 text-amber-700',
  Low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

const MISSING_VALUE = '—'
const TEMPORARY_ACCESS_CODE = 'MOC0813'
const RINGCENTRAL_API_URL = 'https://platform.ringcentral.com'
const fieldClassName = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100'
const buttonPrimaryClassName = 'inline-flex items-center justify-center rounded-md border border-sky-700 bg-sky-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-800'
const buttonSecondaryClassName = 'inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50'

const formatToday = () => new Date().toISOString().slice(0, 10)
const getEntryNoun = (count: number) => (count === 1 ? 'entry' : 'entries')
const getFirstName = (name: string) => {
  const [firstName] = name.trim().split(/\s+/)
  return firstName || 'there'
}
const formatAccountCode = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  return digits ? `ACC-${digits}` : ''
}
const mapNotePriorityToSmsPriority = (value: string): SmsPriority => (value === 'Rush' ? 'High' : 'Medium')
const normalizePhoneNumber = (raw: string) => {
  if (!raw.trim()) return ''
  const normalized = raw.trim().replace(/[^\d+]/g, '')
  if (/^\+1\d{10}$/.test(normalized)) return normalized
  if (/^1\d{10}$/.test(normalized)) return `+${normalized}`
  if (/^\d{10}$/.test(normalized)) return `+1${normalized}`
  return ''
}
const sanitizeSmsErrorMessage = (value: string) =>
  value
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, '******')
    .replace(/\+?\d[\d\s().-]{8,}\d/g, (match) => {
      const digits = match.replace(/\D/g, '')
      return digits.length >= 10 ? `***${digits.slice(-4)}` : '[redacted]'
    })
    .replace(/\s+/g, ' ')
    .trim()
const getSmsApiErrorDetail = (raw: string) => {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    const parsed = JSON.parse(trimmed) as {
      message?: unknown
      error_description?: unknown
      description?: unknown
      errors?: unknown
    }
    const details: string[] = []
    const pushDetail = (value: unknown) => {
      if (typeof value === 'string' && value.trim()) details.push(value.trim())
    }
    pushDetail(parsed.message)
    pushDetail(parsed.error_description)
    pushDetail(parsed.description)
    if (Array.isArray(parsed.errors)) {
      parsed.errors.forEach((entry) => {
        if (typeof entry === 'string') {
          pushDetail(entry)
          return
        }
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>
          pushDetail(record.message)
          pushDetail(record.errorCode)
          pushDetail(record.parameterName)
        }
      })
    }
    return sanitizeSmsErrorMessage(Array.from(new Set(details)).join('. '))
  } catch {
    return sanitizeSmsErrorMessage(trimmed)
  }
}
const getSmsRowLabel = (row: SmsRow) => row.patient.trim() || `Row ${row.id}`
const getInvalidPhoneMessage = () => 'Invalid phone number. Enter a 10-digit US number or +1 number.'
const formatSmsFailureDetails = (details: string[]) => {
  if (!details.length) return ''
  const visibleDetails = details.slice(0, 3)
  const remaining = details.length - visibleDetails.length
  return `Failures: ${visibleDetails.join(' ')}${remaining > 0 ? ` +${remaining} more.` : ''}`
}
const buildInitialSmsMessage = (firstName: string, client: string, prescriber: string) =>
  `Hi ${firstName},\n\n` +
  `This is MyOnlineConsultation. We will review your prescription from the order you placed with ${client || MISSING_VALUE}. For questions regarding tracking or shipping ETA, please contact ${client || MISSING_VALUE}. Our team will communicate with you if you have medication-related questions.\n\n` +
  `Your provider, ${prescriber || MISSING_VALUE}, needs to review your prescription with you. Please reply "YES" to proceed. Your Personal Health Information is protected under HIPAA.\n` +
  'If you have any questions about your medication, feel free to send them here.'
const buildFollowUpSmsMessage = () =>
  'Congratulations your Prescription has been approved! IMPORTANT: If you have any questions regarding the medication you will be prescribed, please feel free to send us any questions here. As part of your health goals, do you have a specific target or outcome you are hoping to achieve?'

const getAge = (dob: string): string => {
  if (!dob) return MISSING_VALUE
  const birthDate = new Date(dob)
  if (Number.isNaN(birthDate.getTime())) return MISSING_VALUE
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDifference = today.getMonth() - birthDate.getMonth()
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) age -= 1
  return age >= 0 ? String(age) : MISSING_VALUE
}

const getHeightInches = (feet: string, inches: string): string => {
  const feetValue = Number(feet || 0)
  const inchesValue = Number(inches || 0)
  if (Number.isNaN(feetValue) || Number.isNaN(inchesValue)) return MISSING_VALUE
  if (!feet && !inches) return MISSING_VALUE
  return String(feetValue * 12 + inchesValue)
}

const getYesNoPhrase = (value: YesNo): string => {
  if (value === 'yes') return 'has'
  if (value === 'no') return 'has not'
  return MISSING_VALUE
}

const fillTemplate = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce((result, [key, value]) => result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || MISSING_VALUE), template)

function MedicalNoteTool({ onBackToTools, onAddSmsRow }: { onBackToTools: () => void; onAddSmsRow: (row: SmsRow) => void }) {
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM)
  const [copyFeedback, setCopyFeedback] = useState('')

  const noteText = useMemo(() => {
    const replacements: Record<string, string> = {
      'PATIENT NAME': formData.patientName || MISSING_VALUE,
      AGE: getAge(formData.dob),
      GENDER: formData.gender || MISSING_VALUE,
      PMH: formData.pmh || MISSING_VALUE,
      BMI: formData.bmi || MISSING_VALUE,
      HAS_WEIGHT_LOSS_PROGRAM: getYesNoPhrase(formData.hasWeightLossProgram),
      HAS_GLP1: getYesNoPhrase(formData.hasGlp1),
      'LAST DOSE': formData.lastDose || MISSING_VALUE,
      PSH: formData.psh || MISSING_VALUE,
      Allergy: formData.allergies || MISSING_VALUE,
      MEDICATION: formData.medications || MISSING_VALUE,
      HEIGHT: getHeightInches(formData.heightFt, formData.heightIn),
      WEIGHT: formData.weight || MISSING_VALUE,
      'ZEPBOUND/MONJAURO or OZEMPIC/WAGOVY': formData.prescribedMedication || MISSING_VALUE,
    }
    return fillTemplate(MEDICAL_NOTE_TEMPLATE, replacements)
  }, [formData])

  const updateField = (key: keyof FormData, value: string) => {
    setCopyFeedback('')
    setFormData((current) => ({ ...current, [key]: value }))
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(noteText)
      setCopyFeedback('Note copied to clipboard.')
    } catch {
      setCopyFeedback('Unable to copy note. Please copy manually from the preview.')
    }
  }

  const handleSmsAndCopy = async () => {
    try {
      await navigator.clipboard.writeText(noteText)
      onAddSmsRow({ id: Date.now(), date: formatToday(), patient: formData.patientName, account: formatAccountCode(formData.account), prescriber: formData.prescriber || '', status: 'Consultation Required', priority: mapNotePriorityToSmsPriority(formData.priority), phone: formData.phone })
      setCopyFeedback('Note copied and added to SMS table.')
    } catch {
      setCopyFeedback('Unable to copy note. Please copy manually from the preview.')
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] px-3 py-4 sm:px-4">
      <div className="mb-3 flex justify-end">
        <button type="button" className={buttonSecondaryClassName} onClick={onBackToTools}>Back to tools</button>
      </div>
      <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Medical Note Template Tool</h1>
      <p className="mt-1 text-sm text-slate-600">All processing stays in your browser. No data is saved or transmitted.</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(340px,1fr)_minmax(380px,1fr)]">
        <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={(event) => event.preventDefault()}>
          <label className="grid gap-1 text-sm text-slate-700">Patient Name<input className={fieldClassName} value={formData.patientName} onChange={(event) => updateField('patientName', event.target.value)} /></label>
          <label className="grid gap-1 text-sm text-slate-700">Date of Birth<input type="date" className={fieldClassName} value={formData.dob} onChange={(event) => updateField('dob', event.target.value)} /></label>
          <label className="grid gap-1 text-sm text-slate-700">Phone Number<input className={fieldClassName} value={formData.phone} onChange={(event) => updateField('phone', event.target.value)} /></label>
          <fieldset className="grid gap-2 rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-xs font-medium text-slate-600">Gender</legend>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="radio" name="gender" checked={formData.gender === 'Male'} onChange={() => updateField('gender', 'Male')} />Male</label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="radio" name="gender" checked={formData.gender === 'Female'} onChange={() => updateField('gender', 'Female')} />Female</label>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-700">Height (ft)<input type="number" min="0" className={fieldClassName} value={formData.heightFt} onChange={(event) => updateField('heightFt', event.target.value)} /></label>
            <label className="grid gap-1 text-sm text-slate-700">Height (in)<input type="number" min="0" className={fieldClassName} value={formData.heightIn} onChange={(event) => updateField('heightIn', event.target.value)} /></label>
          </div>
          <label className="grid gap-1 text-sm text-slate-700">Weight (lbs)<input type="number" min="0" className={fieldClassName} value={formData.weight} onChange={(event) => updateField('weight', event.target.value)} /></label>
          <label className="grid gap-1 text-sm text-slate-700">BMI<input className={fieldClassName} value={formData.bmi} onChange={(event) => updateField('bmi', event.target.value)} /></label>
          <label className="grid gap-1 text-sm text-slate-700">Allergies<textarea className={fieldClassName} value={formData.allergies} onChange={(event) => updateField('allergies', event.target.value)} /></label>
          <label className="grid gap-1 text-sm text-slate-700">Past Medical History (PMH)<textarea className={fieldClassName} value={formData.pmh} onChange={(event) => updateField('pmh', event.target.value)} /></label>
          <label className="grid gap-1 text-sm text-slate-700">Past Surgical History (PSH)<textarea className={fieldClassName} value={formData.psh} onChange={(event) => updateField('psh', event.target.value)} /></label>
          <label className="grid gap-1 text-sm text-slate-700">Current Medications<textarea className={fieldClassName} value={formData.medications} onChange={(event) => updateField('medications', event.target.value)} /></label>
          <fieldset className="grid gap-2 rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-xs font-medium text-slate-600">Previous Weight Loss Programs</legend>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="radio" name="weight-loss" checked={formData.hasWeightLossProgram === 'yes'} onChange={() => updateField('hasWeightLossProgram', 'yes')} />Yes</label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="radio" name="weight-loss" checked={formData.hasWeightLossProgram === 'no'} onChange={() => updateField('hasWeightLossProgram', 'no')} />No</label>
          </fieldset>
          <fieldset className="grid gap-2 rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-xs font-medium text-slate-600">Previous GLP-1 Medication Use</legend>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="radio" name="glp1" checked={formData.hasGlp1 === 'yes'} onChange={() => updateField('hasGlp1', 'yes')} />Yes</label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="radio" name="glp1" checked={formData.hasGlp1 === 'no'} onChange={() => updateField('hasGlp1', 'no')} />No</label>
          </fieldset>
          <label className="grid gap-1 text-sm text-slate-700">Last Dose of GLP-1 or Weight-Loss Medication<input className={fieldClassName} value={formData.lastDose} onChange={(event) => updateField('lastDose', event.target.value)} /></label>
          <label className="grid gap-1 text-sm text-slate-700">Account / Client
            <select className={fieldClassName} value={formData.account} onChange={(event) => updateField('account', event.target.value)}>
              <option value="">Select an account</option>
              {ACCOUNT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-700">Prescriber
            <select className={fieldClassName} value={formData.prescriber} onChange={(event) => updateField('prescriber', event.target.value)}>
              <option value="">Select a prescriber</option>
              {PRESCRIBER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-700">Medication Being Prescribed
            <select className={fieldClassName} value={formData.prescribedMedication} onChange={(event) => updateField('prescribedMedication', event.target.value)}>
              <option value="">Select medication</option>
              {MEDICATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-700">Priority
            <select className={fieldClassName} value={formData.priority} onChange={(event) => updateField('priority', event.target.value)}>
              {NOTE_PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={buttonPrimaryClassName} onClick={handleCopy}>Copy Note</button>
            <button type="button" className={buttonPrimaryClassName} onClick={handleSmsAndCopy}>SMS & Copy</button>
          </div>
          {copyFeedback && <p className="text-sm text-slate-600">{copyFeedback}</p>}
        </form>
        <section className="grid grid-rows-[auto_minmax(0,1fr)] rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Live Preview</h2>
          <pre className="m-0 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">{noteText}</pre>
        </section>
      </div>
    </main>
  )
}

function SmsTableTool({ onBackToTools, rows, setRows }: { onBackToTools: () => void; rows: SmsRow[]; setRows: React.Dispatch<React.SetStateAction<SmsRow[]>> }) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<SmsStatus | ''>('')
  const [filterPriority, setFilterPriority] = useState<SmsPriority | ''>('')
  const [smsToken, setSmsToken] = useState('')
  const [showSmsToken, setShowSmsToken] = useState(false)
  const [fromNumber, setFromNumber] = useState('')
  const [smsFeedback, setSmsFeedback] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [selectedSendAction, setSelectedSendAction] = useState('')
  const nextIdRef = useRef(Math.max(0, ...rows.map((row) => row.id)) + 1)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter((row) => {
      if (q && !row.patient.toLowerCase().includes(q) && !row.prescriber.toLowerCase().includes(q)) return false
      if (filterStatus && row.status !== filterStatus) return false
      if (filterPriority && row.priority !== filterPriority) return false
      return true
    })
  }, [rows, search, filterStatus, filterPriority])

  const stats = useMemo(() => ({
    total: rows.length,
    consultationRequired: rows.filter((row) => row.status === 'Consultation Required').length,
    completed: rows.filter((row) => row.status === 'Completed Visit').length,
    high: rows.filter((row) => row.priority === 'High').length,
  }), [rows])

  const addRow = () => {
    const id = nextIdRef.current++
    setRows((prev) => [...prev, { id, date: formatToday(), patient: '', account: '', prescriber: '', status: 'Consultation Required', priority: 'Medium', phone: '' }])
  }

  const updateRow = <K extends keyof SmsRow>(id: number, field: K, value: SmsRow[K]) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }

  const deleteRow = (id: number) => {
    setRows((prev) => prev.filter((row) => row.id !== id))
  }

  const hasValidSmsCredentials = () => {
    const hasToken = Boolean(smsToken.trim())
    const hasFromNumber = Boolean(normalizePhoneNumber(fromNumber))
    const isValid = hasToken && hasFromNumber
    if (!isValid) {
      if (!hasToken && !hasFromNumber) {
        setSmsFeedback('Enter a RingCentral access token and a valid +1 from number before sending.')
      } else if (!hasToken) {
        setSmsFeedback('Enter a RingCentral access token before sending.')
      } else {
        setSmsFeedback('Enter a valid +1 from number before sending.')
      }
    }
    return isValid
  }

  const sendSms = async (to: string, text: string) => {
    const normalizedFrom = normalizePhoneNumber(fromNumber)
    const normalizedToken = smsToken.trim()
    if (!normalizedToken || !normalizedFrom) {
      return { ok: false, error: 'Missing RingCentral credentials. Enter a current token and a valid +1 from number.' } satisfies SmsSendResult
    }
    try {
      const response = await fetch(`${RINGCENTRAL_API_URL}/restapi/v1.0/account/~/extension/~/sms`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + normalizedToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: { phoneNumber: normalizedFrom },
          to: [{ phoneNumber: to }],
          text,
        }),
      })
      if (response.ok) return { ok: true } satisfies SmsSendResult

      const detail = getSmsApiErrorDetail(await response.text())
      if (response.status === 401) {
        return {
          ok: false,
          error: `Invalid RingCentral credentials. Confirm the access token is current.${detail ? ` ${detail}` : ''}`,
        } satisfies SmsSendResult
      }
      if (response.status === 403) {
        return {
          ok: false,
          error: `RingCentral denied permission to send from this number or extension. Confirm the from number is enabled for the current account.${detail ? ` ${detail}` : ''}`,
        } satisfies SmsSendResult
      }
      return {
        ok: false,
        error: `RingCentral rejected the message (${response.status}${response.statusText ? ` ${response.statusText}` : ''}).${detail ? ` ${detail}` : ''}`,
      } satisfies SmsSendResult
    } catch {
      console.error('RingCentral SMS send failed')
      return { ok: false, error: 'Unable to reach RingCentral. Check your connection and try again.' } satisfies SmsSendResult
    }
  }

  const processSmsRows = async ({
    eligibleStatus,
    sentStatus,
    actionLabel,
    emptyMessage,
    buildMessage,
  }: {
    eligibleStatus: SmsStatus
    sentStatus: SmsStatus
    actionLabel: string
    emptyMessage: string
    buildMessage: (row: SmsRow) => string
  }) => {
    if (!hasValidSmsCredentials()) return
    const eligibleRows = rows.filter((row) => row.status === eligibleStatus)
    if (eligibleRows.length === 0) {
      setSmsFeedback(emptyMessage)
      return
    }
    setIsSending(true)
    setSmsFeedback('')
    try {
      const updates = new Map<number, SmsStatus>()
      let sentCount = 0
      let failedCount = 0
      const failureDetails: string[] = []
      for (const row of eligibleRows) {
        const phone = normalizePhoneNumber(row.phone)
        if (!phone) {
          updates.set(row.id, 'Text failed')
          failedCount += 1
          failureDetails.push(`${getSmsRowLabel(row)}: ${getInvalidPhoneMessage()}`)
          continue
        }
        const result = await sendSms(phone, buildMessage(row))
        if (result.ok) {
          updates.set(row.id, sentStatus)
          sentCount += 1
        } else {
          updates.set(row.id, 'Text failed')
          failedCount += 1
          failureDetails.push(`${getSmsRowLabel(row)}: ${result.error}`)
        }
      }
      setRows((prev) => prev.map((row) => (updates.has(row.id) ? { ...row, status: updates.get(row.id)! } : row)))
      const processedCount = sentCount + failedCount
      const failureSummary = formatSmsFailureDetails(failureDetails)
      setSmsFeedback(`Processed ${processedCount} ${actionLabel} ${getEntryNoun(processedCount)} (sent: ${sentCount}, failed: ${failedCount}).${failureSummary ? ` ${failureSummary}` : ''}`)
    } finally {
      setIsSending(false)
    }
  }

  const sendConsultationRequired = async () =>
    processSmsRows({
      eligibleStatus: 'Consultation Required',
      sentStatus: 'Notified',
      actionLabel: 'consultation-required',
      emptyMessage: 'No consultation-required entries were found to process.',
      buildMessage: (row) => buildInitialSmsMessage(getFirstName(row.patient), row.account, row.prescriber),
    })

  const sendFollowUpTexts = async () =>
    processSmsRows({
      eligibleStatus: 'Replied Yes',
      sentStatus: '2nd Text Sent',
      actionLabel: 'replied-yes',
      emptyMessage: 'No replied-yes entries were found to process.',
      buildMessage: () => buildFollowUpSmsMessage(),
    })

  return (
    <main className="min-h-screen w-full px-3 py-4 sm:px-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-[28px]">SMS table</h1>
            <p className="mt-1 text-sm text-slate-600">Track and manage SMS workflow details</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={buttonSecondaryClassName} onClick={onBackToTools}>Back to tools</button>
            <button type="button" className={buttonPrimaryClassName} onClick={addRow}>+ Add entry</button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[{ label: 'Total', value: stats.total }, { label: 'Consultation required', value: stats.consultationRequired }, { label: 'Completed visits', value: stats.completed }, { label: 'High priority', value: stats.high }].map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as SmsStatus | '')} className={`${fieldClassName} w-full sm:w-[180px]`}>
            <option value="">All statuses</option>
            {STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
          <select value={filterPriority} onChange={(event) => setFilterPriority(event.target.value as SmsPriority | '')} className={`${fieldClassName} w-full sm:w-[160px]`}>
            <option value="">All priorities</option>
            {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
          </select>
          <input type="text" placeholder="Search patient or prescriber…" value={search} onChange={(event) => setSearch(event.target.value)} className={`${fieldClassName} w-full sm:ml-auto sm:max-w-xs`} />
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(220px,1fr)_minmax(200px,220px)_minmax(220px,240px)]">
          <div className="flex gap-2">
            <input
              type={showSmsToken ? 'text' : 'password'}
              placeholder="RingCentral access token"
              value={smsToken}
              onChange={(event) => setSmsToken(event.target.value)}
              autoComplete="new-password"
              spellCheck={false}
              data-form-type="other"
              className={fieldClassName}
            />
            <button type="button" className={buttonSecondaryClassName} onClick={() => setShowSmsToken((current) => !current)}>
              {showSmsToken ? 'Hide' : 'Show'}
            </button>
          </div>
          <input
            type="tel"
            placeholder="From number (+1##########)"
            value={fromNumber}
            onChange={(event) => setFromNumber(event.target.value)}
            className={fieldClassName}
          />
          <select
            value={selectedSendAction}
            onChange={async (event) => {
              const action = event.target.value
              if (!action) return
              setSelectedSendAction(action)

              try {
                if (action === 'consultation-required') {
                  await sendConsultationRequired()
                } else if (action === 'follow-up') {
                  await sendFollowUpTexts()
                }
              } finally {
                setSelectedSendAction('')
              }
            }}
            className={fieldClassName}
            disabled={isSending}
          >
            <option value="">Send Action</option>
            <option value="consultation-required">Process Consultation Required</option>
            <option value="follow-up">2nd Text Follow-up</option>
          </select>
        </div>
        <p className="mt-2 text-xs text-slate-500">Token and from number are kept in memory for this page load only.</p>
        {smsFeedback && <p className="mt-2 text-sm text-slate-600" role="status" aria-live="polite">{smsFeedback}</p>}

        <div className="mt-4 overflow-x-auto overflow-y-hidden rounded-lg border border-slate-200">
          <table className="w-full min-w-[900px] table-auto text-left text-xs text-slate-700">
            <colgroup>
              <col style={{ width: '110px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '190px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '40px' }} />
            </colgroup>
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {['Date', 'Patient name', 'Client account', 'Prescriber', 'Status', 'Priority', 'Phone number', ''].map((heading) => (
                  <th key={heading} className="px-2 py-2 font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">No entries — click “Add entry” to start</td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="px-2 py-2 align-top"><input type="date" value={row.date} onChange={(event) => updateRow(row.id, 'date', event.target.value)} className="w-full min-w-0 rounded-md border border-slate-200 px-2 py-1.5 text-[11px]" /></td>
                    <td className="px-2 py-2 align-top"><input type="text" value={row.patient} placeholder="Patient name" onChange={(event) => updateRow(row.id, 'patient', event.target.value)} className="w-full min-w-0 rounded-md border border-slate-200 px-2 py-1.5 text-[11px]" /></td>
                    <td className="px-2 py-2 align-top"><input type="text" value={row.account} placeholder="ACC-####" onChange={(event) => updateRow(row.id, 'account', event.target.value)} className="w-full min-w-0 rounded-md border border-slate-200 px-2 py-1.5 text-[11px]" /></td>
                    <td className="px-2 py-2 align-top"><input type="text" value={row.prescriber} placeholder="Dr. Name" onChange={(event) => updateRow(row.id, 'prescriber', event.target.value)} className="w-full min-w-0 rounded-md border border-slate-200 px-2 py-1.5 text-[11px]" /></td>
                    <td className="px-2 py-2 align-top">
                      <select value={row.status} onChange={(event) => updateRow(row.id, 'status', event.target.value as SmsStatus)} className={`w-full min-w-[180px] rounded-md border px-2 py-1.5 text-[11px] font-medium ${STATUS_STYLES[row.status]}`}>
                        {STATUSES.map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <select value={row.priority} onChange={(event) => updateRow(row.id, 'priority', event.target.value as SmsPriority)} className={`w-full min-w-0 rounded-md border px-2 py-1.5 text-[11px] font-medium ${PRIORITY_STYLES[row.priority]}`}>
                        {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 align-top"><input type="tel" value={row.phone} placeholder="(000) 000-0000" onChange={(event) => updateRow(row.id, 'phone', event.target.value)} className="w-full min-w-0 rounded-md border border-slate-200 px-2 py-1.5 text-[11px]" /></td>
                    <td className="px-2 py-2 text-right align-top">
                      <button type="button" aria-label="Delete row" className="inline-flex rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50" onClick={() => deleteRow(row.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Showing {filtered.length} of {rows.length} entries</span>
          <div className="inline-flex items-center gap-1">
            <button type="button" className="rounded-md border border-slate-200 px-2 py-1 text-slate-500" disabled>Previous</button>
            <span className="rounded-md border border-slate-200 px-2 py-1 text-slate-600">1</span>
            <button type="button" className="rounded-md border border-slate-200 px-2 py-1 text-slate-500" disabled>Next</button>
          </div>
        </div>
      </section>
    </main>
  )
}

function App() {
  const [accessCode, setAccessCode] = useState('')
  const [accessError, setAccessError] = useState('')
  const [isAccessGranted, setIsAccessGranted] = useState(false)
  const [selectedTool, setSelectedTool] = useState<ToolSelection>(null)
  const [smsRows, setSmsRows] = useState<SmsRow[]>(INITIAL_SMS_ROWS)

  const handleAccessSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (accessCode.trim().toUpperCase() === TEMPORARY_ACCESS_CODE) {
      setAccessError('')
      setIsAccessGranted(true)
      return
    }
    setAccessError('Invalid access code. Please try again.')
  }

  if (!isAccessGranted) {
    return (
      <main className="grid min-h-screen place-items-center px-3 py-6">
        <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">BirkeHealth Tools</h1>
          <p className="mt-1 text-sm text-slate-600">Enter the access code to continue. This gate is client-side only and should not be treated as secure authentication.</p>
          <form onSubmit={handleAccessSubmit} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm text-slate-700">Access Code<input className={fieldClassName} value={accessCode} onChange={(event) => { setAccessError(''); setAccessCode(event.target.value) }} /></label>
            <button type="submit" className={buttonPrimaryClassName}>Continue</button>
          </form>
          {accessError && <p className="mt-3 text-sm text-slate-600">{accessError}</p>}
        </section>
      </main>
    )
  }

  if (selectedTool === null) {
    return (
      <main className="grid min-h-screen place-items-center px-3 py-6">
        <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Select a Tool</h1>
          <p className="mt-1 text-sm text-slate-600">Choose a tool to open.</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className={buttonPrimaryClassName} onClick={() => setSelectedTool('medical-note')}>Medical Note</button>
            <button type="button" className={buttonSecondaryClassName} onClick={() => setSelectedTool('sms-table')}>SMS TABLE</button>
          </div>
        </section>
      </main>
    )
  }

  if (selectedTool === 'medical-note') {
    return <MedicalNoteTool onBackToTools={() => setSelectedTool(null)} onAddSmsRow={(row) => setSmsRows((current) => [...current, row])} />
  }

  return <SmsTableTool onBackToTools={() => setSelectedTool(null)} rows={smsRows} setRows={setSmsRows} />
}

export default App
