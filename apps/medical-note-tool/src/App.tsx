import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'

type YesNo = '' | 'yes' | 'no'
type ToolSelection = 'medical-note' | 'sms-table' | 'sms-templates' | null

type SmsTemplates = {
  consultationRequired: string
  followUp: string
  completed: string
}

type FormData = {
  noteType: string
  patientName: string
  dob: string
  phone: string
  gender: string
  heightFt: string
  heightIn: string
  weight: string
  allergies: string
  pmh: string
  psh: string
  medications: string
  // Follow-up & provider
  followUpInterval: string
  providerName: string
  // Free-text additional notes
  additionalNotes: string
  // Weight Management specific
  hasWeightLossProgram: YesNo
  hasGlp1: YesNo
  lastDose: string
  prescribedMedication: string
  brandName: string
  goalBmi: string
  // Contraindications (patient denies)
  contraDiabetes: boolean
  contraPancreatitis: boolean
  contraGastroparesis: boolean
  contraSeizures: boolean
  contraGlaucoma: boolean
  contraMtc: boolean
  contraMen2: boolean
  // SMS / admin
  account: string
  prescriber: string
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
const ACCOUNT_OPTIONS_STORAGE_KEY = 'medical-note-account-options'
const PRESCRIBER_OPTIONS = ['ALBERTO NUNEZ PINA', 'YADIRA JEAN-LOUIS', 'LUK JEAN-LOUIS', 'EMILIO LUIS GONZALEZ', 'CHARLES SAROSY', 'ELIAZER MORGAN']
const MEDICATION_OPTIONS = ['OZEMPIC/WAGOVY', 'ZEPBOUND/MONJAURO']
const NOTE_PRIORITY_OPTIONS = ['Normal', 'Rush']
const NOTE_TYPE_OPTIONS = [
  'Anti-Aging',
  'Anti-Aging Follow Up',
  'Acne',
  'Erectile Dysfunction',
  'Female Sexual Health',
  'Hair',
  'General',
  'Other',
  'Medical Protocols',
  'NAD',
  'Nasal Sprays',
  'Pre-Workout Protocols',
  'Routine Checkup',
  'Sexual Health',
  'Sermorelin Therapy',
  'Sleep Aid',
  'Test',
  'Weight Management',
  'Weight Management Follow Up',
]
const STATUSES: SmsStatus[] = ['Consultation Required', 'Notified', '2nd Text Sent', 'Replied Yes', 'Replied 2nd Text', 'Completed Visit', 'Text failed']
const PRIORITIES: SmsPriority[] = ['High', 'Medium', 'Low']

type ContraKey = 'contraDiabetes' | 'contraPancreatitis' | 'contraGastroparesis' | 'contraSeizures' | 'contraGlaucoma' | 'contraMtc' | 'contraMen2'
const CONTRAINDICATION_FIELDS: { key: ContraKey; label: string }[] = [
  { key: 'contraDiabetes', label: 'Type 1 Diabetes' },
  { key: 'contraPancreatitis', label: 'Pancreatitis' },
  { key: 'contraGastroparesis', label: 'Gastroparesis' },
  { key: 'contraSeizures', label: 'Seizures' },
  { key: 'contraGlaucoma', label: 'Glaucoma' },
  { key: 'contraMtc', label: 'Personal/Family Hx of MTC' },
  { key: 'contraMen2', label: 'Personal/Family Hx of MEN2' },
]

const INITIAL_FORM: FormData = {
  noteType: '', patientName: '', dob: '', phone: '', gender: '',
  heightFt: '', heightIn: '', weight: '',
  allergies: '', pmh: '', psh: '', medications: '',
  followUpInterval: '', providerName: '',
  additionalNotes: '',
  hasWeightLossProgram: '', hasGlp1: '', lastDose: '',
  prescribedMedication: '', brandName: '', goalBmi: '',
  contraDiabetes: false, contraPancreatitis: false, contraGastroparesis: false,
  contraSeizures: false, contraGlaucoma: false, contraMtc: false, contraMen2: false,
  account: '', prescriber: '', priority: 'Normal',
}

const INITIAL_SMS_ROWS: SmsRow[] = []

// ── Note generation ──────────────────────────────────────────────────────────

const v = (val: string | undefined | null) => val?.trim() || MISSING_VALUE

const calcBmi = (heightFt: string, heightIn: string, weight: string): string => {
  const totalInches = Number(heightFt || 0) * 12 + Number(heightIn || 0)
  const weightLbs = Number(weight || 0)
  if (!totalInches || !weightLbs) return MISSING_VALUE
  return (weightLbs / (totalInches * totalInches) * 703).toFixed(1)
}

const PHYSICAL_EXAM_BLOCK = `Physical Exam: Telehealth PE — Asynchronous
General: Well developed, well nourished.
HEENT: Normocephalic, atraumatic, conjunctiva clear. No rhinorrhea. No obvious masses noted.
Skin: No rashes noted.
Other: The patient was examined via synchronous telemedicine, with its associated limitations.`

const buildMedHistorySection = (fd: FormData): string => [
  `Past Medical History: ${v(fd.pmh)}`,
  ``,
  `Past Surgical History: ${v(fd.psh)}`,
  ``,
  `Allergies: ${v(fd.allergies)}`,
  ``,
  `Medications: ${v(fd.medications)}`,
].join('\n')

const buildFollowUpSection = (fd: FormData): string => {
  const parts = [
    `Follow-up: ${v(fd.followUpInterval)}`,
    `Provider: ${v(fd.providerName)}`,
  ]
  if (fd.additionalNotes?.trim()) {
    parts.push(``, `Additional Notes:`, fd.additionalNotes.trim())
  }
  return parts.join('\n')
}

const buildWeightManagementBody = (fd: FormData): string => {
  const bmi = calcBmi(fd.heightFt, fd.heightIn, fd.weight)
  const hasTriedPrograms = fd.hasWeightLossProgram === 'yes' ? 'has' : fd.hasWeightLossProgram === 'no' ? 'has not' : MISSING_VALUE
  const hasTriedGlp1 = fd.hasGlp1 === 'yes' ? 'has' : fd.hasGlp1 === 'no' ? 'has not' : MISSING_VALUE

  const contraDenials: string[] = []
  if (fd.contraDiabetes) contraDenials.push('type 1 diabetes')
  if (fd.contraPancreatitis) contraDenials.push('pancreatitis')
  if (fd.contraGastroparesis) contraDenials.push('gastroparesis')
  if (fd.contraSeizures) contraDenials.push('seizures')
  if (fd.contraGlaucoma) contraDenials.push('glaucoma')
  if (fd.contraMtc) contraDenials.push('personal or family history of Medullary Thyroid Cancer')
  if (fd.contraMen2) contraDenials.push('personal or family history of Multiple Endocrine Neoplasia Type 2')
  const contraDenialText = contraDenials.length
    ? `Denies ${contraDenials.join(', ')}.`
    : `No contraindications documented.`

  const brandDisplay = v(fd.brandName) !== MISSING_VALUE ? v(fd.brandName) : v(fd.prescribedMedication)
  const goalBmiDisplay = v(fd.goalBmi) !== MISSING_VALUE ? v(fd.goalBmi) : bmi !== MISSING_VALUE ? '22–24' : MISSING_VALUE

  return [
    `Patient ${hasTriedPrograms} tried any weight loss programs. The patient ${hasTriedGlp1} tried any GLP-1 medications in the past. The patient's last dose of GLP-1 medication or any weight loss related medication (generic or non-generic) is ${v(fd.lastDose)}.`,
    ``,
    `The patient is interested in GLP-1 RA medications. ${contraDenialText}`,
    ``,
    `Assessment:`,
    `Z71.3 — Dietary Counseling and Surveillance`,
    `Z72.4 — Inappropriate Diet and Eating Habits`,
    ``,
    `Plan:`,
    `The patient is a candidate for GLP-1 RA medication. Prescribing for ${v(fd.patientName)}. We will initiate non-commercial dosing as it has been identified that the patient will see significant benefit from dosing that is not available under brand name ${brandDisplay}.`,
    ``,
    `Information on risks, benefits, and alternatives to treatment (including possible side effects such as nausea, vomiting, and abdominal pain, rarer side effects including pancreatitis, cholecystitis, kidney injury, hypoglycemia, and potential for malignancy), possibility of treatment failure, and expected duration of therapy (which could last several months to several years) has been discussed.`,
    ``,
    `Will aim for no more than 1–2 lbs per week of weight loss and hope to achieve a goal BMI of ${goalBmiDisplay}. Will adjust dosing based on response and side effects.`,
    ``,
    `Recommend drinking sufficient water and adhering to a balanced diet with appropriate portion control.`,
  ].join('\n')
}

const buildGenericBody = (fd: FormData, noteType: string): string => {
  const hpi = fd.additionalNotes?.trim()
    ? fd.additionalNotes.trim()
    : MISSING_VALUE
  return [
    `Chief Complaint: Patient presenting for ${noteType}.`,
    ``,
    `History of Present Illness: ${hpi}`,
    ``,
    `Assessment/Plan:`,
    `Patient evaluated via telehealth. Will manage ${noteType} as discussed with patient.`,
  ].join('\n')
}

const generateNote = (fd: FormData): string => {
  const noteType = fd.noteType || 'General'
  const today = formatToday()
  const bmi = calcBmi(fd.heightFt, fd.heightIn, fd.weight)
  const heightIn = getHeightInches(fd.heightFt, fd.heightIn)

  const header = [
    `Date of Service: ${today}`,
    `Visit Type: ${noteType}`,
    ``,
    `The patient ${v(fd.patientName)} is a ${getAge(fd.dob)} year old ${v(fd.gender)} presenting for ${noteType}.`,
  ].join('\n')

  const vitals = [
    `Vitals:`,
    `Height: ${heightIn} in | Weight: ${v(fd.weight)} lbs | BMI: ${bmi}`,
  ].join('\n')

  const isWeightManagement = noteType === 'Weight Management' || noteType === 'Weight Management Follow Up'
  const visitBody = isWeightManagement
    ? buildWeightManagementBody(fd)
    : buildGenericBody(fd, noteType)

  return [
    header,
    ``,
    vitals,
    ``,
    visitBody,
    ``,
    buildMedHistorySection(fd),
    ``,
    PHYSICAL_EXAM_BLOCK,
    ``,
    buildFollowUpSection(fd),
  ].join('\n')
}


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

const getInitialAccountOptions = (): string[] => {
  if (typeof window === 'undefined') return ACCOUNT_OPTIONS
  try {
    const raw = window.localStorage.getItem(ACCOUNT_OPTIONS_STORAGE_KEY)
    if (!raw) return ACCOUNT_OPTIONS
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return ACCOUNT_OPTIONS
    const options = parsed
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
    return options.length ? Array.from(new Set(options)) : ACCOUNT_OPTIONS
  } catch {
    return ACCOUNT_OPTIONS
  }
}

const MISSING_VALUE = '—'
const TEMPORARY_ACCESS_CODE = 'MOC0813'
// SMS requests are forwarded to the server-side API which handles
// RingCentral JWT auth and stores the sender credentials as env variables.
// VITE_API_URL must be set at build time for production deployments where the
// API lives on a different origin (e.g. https://medical-note-api.onrender.com).
// In development the Vite proxy rewrites /api to localhost:3001 automatically.
const API_URL_PREFIX: string = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const SMS_API_URL = `${API_URL_PREFIX}/api/sms`
const SMS_ROWS_API_URL = `${API_URL_PREFIX}/api/sms-rows`
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
const DEFAULT_CONSULTATION_TEMPLATE =
  'Hi {{firstName}},\n\n' +
  'This is MyOnlineConsultation. We will review your prescription from the order you placed with {{client}}. For questions regarding tracking or shipping ETA, please contact {{client}}. Our team will communicate with you if you have medication-related questions.\n\n' +
  'Your provider, {{prescriber}}, needs to review your prescription with you. Please reply "YES" to proceed. Your Personal Health Information is protected under HIPAA.\n' +
  'If you have any questions about your medication, feel free to send them here.'
const DEFAULT_FOLLOW_UP_TEMPLATE =
  'Congratulations your Prescription has been approved! IMPORTANT: If you have any questions regarding the medication you will be prescribed, please feel free to send us any questions here. As part of your health goals, do you have a specific target or outcome you are hoping to achieve?'
const DEFAULT_COMPLETED_TEMPLATE =
  'Hi {{firstName}}, your consultation visit has been completed. Thank you for choosing MyOnlineConsultation. If you have any follow-up questions about your medication or care plan, feel free to reach out here.'

const INITIAL_SMS_TEMPLATES: SmsTemplates = {
  consultationRequired: DEFAULT_CONSULTATION_TEMPLATE,
  followUp: DEFAULT_FOLLOW_UP_TEMPLATE,
  completed: DEFAULT_COMPLETED_TEMPLATE,
}

const buildConsultationMessage = (template: string, firstName: string, client: string, prescriber: string) =>
  fillTemplate(template, { firstName, client, prescriber })

const buildCompletedMessage = (template: string, firstName: string) =>
  fillTemplate(template, { firstName })

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

const fillTemplate = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce((result, [key, value]) => result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || MISSING_VALUE), template)

function SmsTemplatesTool({ onBackToTools, templates, setTemplates }: { onBackToTools: () => void; templates: SmsTemplates; setTemplates: React.Dispatch<React.SetStateAction<SmsTemplates>> }) {
  const updateTemplate = (key: keyof SmsTemplates, value: string) => {
    setTemplates((current) => ({ ...current, [key]: value }))
  }

  const resetTemplate = (key: keyof SmsTemplates, defaultValue: string) => {
    setTemplates((current) => ({ ...current, [key]: defaultValue }))
  }

  return (
    <main className="min-h-screen w-full px-3 py-4 sm:px-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-[28px]">SMS Templates</h1>
            <p className="mt-1 text-sm text-slate-600">Edit the message templates used when sending SMS actions. Changes are kept for this session.</p>
          </div>
          <button type="button" className={buttonSecondaryClassName} onClick={onBackToTools}>Back to tools</button>
        </div>

        <div className="mt-5 grid gap-5">
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-semibold text-slate-800">Process Consultation Required Template</label>
              <button type="button" className={buttonSecondaryClassName} onClick={() => resetTemplate('consultationRequired', DEFAULT_CONSULTATION_TEMPLATE)}>Reset to default</button>
            </div>
            <p className="text-xs text-slate-500">Supports placeholders: <code className="rounded bg-slate-200 px-1 py-0.5">{'{{firstName}}'}</code>, <code className="rounded bg-slate-200 px-1 py-0.5">{'{{client}}'}</code>, <code className="rounded bg-slate-200 px-1 py-0.5">{'{{prescriber}}'}</code></p>
            <textarea
              className={`${fieldClassName} min-h-[160px] resize-y font-mono text-xs`}
              value={templates.consultationRequired}
              onChange={(event) => updateTemplate('consultationRequired', event.target.value)}
            />
          </div>

          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-semibold text-slate-800">2nd Text Follow Up Template</label>
              <button type="button" className={buttonSecondaryClassName} onClick={() => resetTemplate('followUp', DEFAULT_FOLLOW_UP_TEMPLATE)}>Reset to default</button>
            </div>
            <textarea
              className={`${fieldClassName} min-h-[120px] resize-y font-mono text-xs`}
              value={templates.followUp}
              onChange={(event) => updateTemplate('followUp', event.target.value)}
            />
          </div>

          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-semibold text-slate-800">Completed Text Template</label>
              <button type="button" className={buttonSecondaryClassName} onClick={() => resetTemplate('completed', DEFAULT_COMPLETED_TEMPLATE)}>Reset to default</button>
            </div>
            <p className="text-xs text-slate-500">Supports placeholders: <code className="rounded bg-slate-200 px-1 py-0.5">{'{{firstName}}'}</code></p>
            <textarea
              className={`${fieldClassName} min-h-[120px] resize-y font-mono text-xs`}
              value={templates.completed}
              onChange={(event) => updateTemplate('completed', event.target.value)}
            />
          </div>
        </div>
      </section>
    </main>
  )
}

function MedicalNoteTool({ onBackToTools, onAddSmsRow }: { onBackToTools: () => void; onAddSmsRow: (row: SmsRow) => void }) {
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM)
  const [copyFeedback, setCopyFeedback] = useState('')
  const [accountOptions, setAccountOptions] = useState<string[]>(() => getInitialAccountOptions())
  const [newAccountOption, setNewAccountOption] = useState('')

  const noteText = useMemo(() => generateNote(formData), [formData])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(ACCOUNT_OPTIONS_STORAGE_KEY, JSON.stringify(accountOptions))
  }, [accountOptions])

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

  const isWeightManagement = formData.noteType === 'Weight Management' || formData.noteType === 'Weight Management Follow Up'
  const autoBmi = calcBmi(formData.heightFt, formData.heightIn, formData.weight)

  const updateBoolField = (key: ContraKey, value: boolean) => {
    setCopyFeedback('')
    setFormData((current) => ({ ...current, [key]: value }))
  }

  const addAccountOption = () => {
    const nextOption = newAccountOption.trim()
    if (!nextOption) return
    const alreadyExists = accountOptions.find((option) => option.toLowerCase() === nextOption.toLowerCase())
    if (alreadyExists) {
      setNewAccountOption('')
      updateField('account', alreadyExists)
      return
    }
    setCopyFeedback('')
    setAccountOptions((current) => [...current, nextOption])
    setNewAccountOption('')
    setFormData((current) => ({ ...current, account: nextOption }))
  }

  const removeAccountOption = (optionToRemove: string) => {
    setCopyFeedback('')
    setAccountOptions((current) => current.filter((option) => option !== optionToRemove))
    setFormData((current) => (
      current.account === optionToRemove
        ? { ...current, account: '' }
        : current
    ))
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
          <label className="grid gap-1 text-sm text-slate-700">Medical Note Type
            <select className={fieldClassName} value={formData.noteType} onChange={(event) => updateField('noteType', event.target.value)}>
              <option value="">Select a note type</option>
              {NOTE_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
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
            <label className="grid gap-1 text-sm text-slate-700">Height (in)<input type="number" min="0" max="11" className={fieldClassName} value={formData.heightIn} onChange={(event) => updateField('heightIn', event.target.value)} /></label>
          </div>
          <label className="grid gap-1 text-sm text-slate-700">Weight (lbs)<input type="number" min="0" className={fieldClassName} value={formData.weight} onChange={(event) => updateField('weight', event.target.value)} /></label>
          <label className="grid gap-1 text-sm text-slate-700">BMI (auto-calculated)
            <input className={`${fieldClassName} bg-slate-50 text-slate-500`} readOnly value={autoBmi === MISSING_VALUE ? '' : autoBmi} placeholder="Enter height and weight" />
          </label>
          <label className="grid gap-1 text-sm text-slate-700">Past Medical History (PMH)<textarea className={fieldClassName} value={formData.pmh} onChange={(event) => updateField('pmh', event.target.value)} /></label>
          <label className="grid gap-1 text-sm text-slate-700">Past Surgical History (PSH)<textarea className={fieldClassName} value={formData.psh} onChange={(event) => updateField('psh', event.target.value)} /></label>
          <label className="grid gap-1 text-sm text-slate-700">Allergies<textarea className={fieldClassName} value={formData.allergies} onChange={(event) => updateField('allergies', event.target.value)} /></label>
          <label className="grid gap-1 text-sm text-slate-700">Current Medications<textarea className={fieldClassName} value={formData.medications} onChange={(event) => updateField('medications', event.target.value)} /></label>

          {isWeightManagement && (
            <fieldset className="grid gap-3 rounded-md border border-slate-200 p-3">
              <legend className="px-1 text-xs font-medium text-slate-600">Weight Management</legend>
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
              <label className="grid gap-1 text-sm text-slate-700">Medication Being Prescribed
                <select className={fieldClassName} value={formData.prescribedMedication} onChange={(event) => updateField('prescribedMedication', event.target.value)}>
                  <option value="">Select medication</option>
                  {MEDICATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm text-slate-700">Brand Name<input className={fieldClassName} value={formData.brandName} onChange={(event) => updateField('brandName', event.target.value)} /></label>
              <label className="grid gap-1 text-sm text-slate-700">Goal BMI<input type="number" min="0" step="0.1" className={fieldClassName} value={formData.goalBmi} onChange={(event) => updateField('goalBmi', event.target.value)} /></label>
              <fieldset className="grid gap-2 rounded-md border border-slate-200 p-3">
                <legend className="px-1 text-xs font-medium text-slate-600">Contraindications — Patient Denies</legend>
                {CONTRAINDICATION_FIELDS.map(({ key, label }) => (
                  <label key={key} className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={formData[key]} onChange={(e) => updateBoolField(key, e.target.checked)} />
                    {label}
                  </label>
                ))}
              </fieldset>
            </fieldset>
          )}

          <label className="grid gap-1 text-sm text-slate-700">Follow-up Interval<input className={fieldClassName} value={formData.followUpInterval} onChange={(event) => updateField('followUpInterval', event.target.value)} placeholder="e.g. 3–4 weeks" /></label>
          <label className="grid gap-1 text-sm text-slate-700">Provider Name<input className={fieldClassName} value={formData.providerName} onChange={(event) => updateField('providerName', event.target.value)} /></label>
          <label className="grid gap-1 text-sm text-slate-700">Additional Notes<textarea className={`${fieldClassName} min-h-[80px]`} value={formData.additionalNotes} onChange={(event) => updateField('additionalNotes', event.target.value)} /></label>
          <label className="grid gap-1 text-sm text-slate-700">Account / Client
            <select className={fieldClassName} value={formData.account} onChange={(event) => updateField('account', event.target.value)}>
              <option value="">Select an account</option>
              {accountOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap gap-2">
              <input
                className={`${fieldClassName} flex-1`}
                value={newAccountOption}
                onChange={(event) => setNewAccountOption(event.target.value)}
                placeholder="Add Account / Client option"
              />
              <button type="button" className={buttonSecondaryClassName} onClick={addAccountOption}>Add</button>
            </div>
            {accountOptions.length > 0 && (
              <ul className="grid gap-1">
                {accountOptions.map((option) => (
                  <li key={option} className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                    <span>{option}</span>
                    <button type="button" className="text-rose-600 transition hover:text-rose-700" onClick={() => removeAccountOption(option)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="grid gap-1 text-sm text-slate-700">Prescriber
            <select className={fieldClassName} value={formData.prescriber} onChange={(event) => updateField('prescriber', event.target.value)}>
              <option value="">Select a prescriber</option>
              {PRESCRIBER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
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

function SmsTableTool({
  onBackToTools,
  rows,
  onCreateRow,
  onUpdateRow,
  onDeleteRow,
  templates,
  rowsStatusMessage,
}: {
  onBackToTools: () => void
  rows: SmsRow[]
  onCreateRow: (row: SmsRow) => void
  onUpdateRow: (row: SmsRow) => void
  onDeleteRow: (id: number) => void
  templates: SmsTemplates
  rowsStatusMessage: string
}) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<SmsStatus | ''>('')
  const [filterPriority, setFilterPriority] = useState<SmsPriority | ''>('')
  const [smsFeedback, setSmsFeedback] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [selectedSendAction, setSelectedSendAction] = useState('')
  const nextIdRef = useRef(1)

  useEffect(() => {
    const maxId = Math.max(0, ...rows.map((row) => row.id))
    if (nextIdRef.current <= maxId) {
      nextIdRef.current = maxId + 1
    }
  }, [rows])

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
    onCreateRow({ id, date: formatToday(), patient: '', account: '', prescriber: '', status: 'Consultation Required', priority: 'Medium', phone: '' })
  }

  const updateRow = <K extends keyof SmsRow>(id: number, field: K, value: SmsRow[K]) => {
    const row = rows.find((entry) => entry.id === id)
    if (!row) return
    onUpdateRow({ ...row, [field]: value })
  }

  const deleteRow = (id: number) => {
    onDeleteRow(id)
  }

  const sendSms = async (to: string, text: string): Promise<SmsSendResult> => {
    try {
      const response = await fetch(SMS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, text }),
      })
      if (response.ok) return { ok: true } satisfies SmsSendResult

      const data = (await response.json().catch(() => ({}))) as { error?: string; detail?: string }
      const detail = data.detail ? getSmsApiErrorDetail(data.detail) : ''
      const errorMessage = data.error ?? `SMS request failed (${response.status})`

      if (response.status === 500) {
        return { ok: false, error: 'SMS service error. Contact the administrator.' } satisfies SmsSendResult
      }
      return {
        ok: false,
        error: `${errorMessage}${detail ? ` ${detail}` : ''}`,
      } satisfies SmsSendResult
    } catch {
      console.error('SMS API request failed')
      return { ok: false, error: 'Unable to reach the SMS service. Check your connection and try again.' } satisfies SmsSendResult
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
      rows.forEach((row) => {
        const status = updates.get(row.id)
        if (!status) return
        onUpdateRow({ ...row, status })
      })
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
      buildMessage: (row) => buildConsultationMessage(templates.consultationRequired, getFirstName(row.patient), row.account, row.prescriber),
    })

  const sendFollowUpTexts = async () =>
    processSmsRows({
      eligibleStatus: 'Replied Yes',
      sentStatus: '2nd Text Sent',
      actionLabel: 'replied-yes',
      emptyMessage: 'No replied-yes entries were found to process.',
      buildMessage: () => templates.followUp,
    })

  const sendCompletedTexts = async () =>
    processSmsRows({
      eligibleStatus: 'Completed Visit',
      sentStatus: 'Completed Visit',
      actionLabel: 'completed-visit',
      emptyMessage: 'No completed-visit entries were found to process.',
      buildMessage: (row) => buildCompletedMessage(templates.completed, getFirstName(row.patient)),
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

        <div className="mt-3 flex flex-wrap items-center gap-2">
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
                } else if (action === 'completed') {
                  await sendCompletedTexts()
                }
              } finally {
                setSelectedSendAction('')
              }
            }}
            className={`${fieldClassName} w-full sm:w-[260px]`}
            disabled={isSending}
          >
            <option value="">Send Action</option>
            <option value="consultation-required">Process Consultation Required</option>
            <option value="follow-up">2nd Text Follow-up</option>
            <option value="completed">Completed Text</option>
          </select>
        </div>
        {smsFeedback && <p className="mt-2 text-sm text-slate-600" role="status" aria-live="polite">{smsFeedback}</p>}
        {rowsStatusMessage && <p className="mt-2 text-sm text-slate-600" role="status" aria-live="polite">{rowsStatusMessage}</p>}

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
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplates>(INITIAL_SMS_TEMPLATES)
  const [rowsStatusMessage, setRowsStatusMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const loadRows = async () => {
      try {
        const response = await fetch(SMS_ROWS_API_URL, { signal: controller.signal })
        if (!response.ok) throw new Error(`Failed to load rows (${response.status})`)
        const data = (await response.json()) as { rows?: SmsRow[] }
        setSmsRows(Array.isArray(data.rows) ? data.rows : [])
        setRowsStatusMessage('')
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Failed to load SMS rows:', error)
        setRowsStatusMessage('Unable to load saved SMS rows. Showing local state only.')
      }
    }
    void loadRows()
    return () => controller.abort()
  }, [])

  const createSmsRow = (row: SmsRow) => {
    setSmsRows((current) => [...current, row])
    void (async () => {
      try {
        const response = await fetch(SMS_ROWS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row),
        })
        if (response.status === 409) {
          setSmsRows((current) => {
            let hasSeenRow = false
            return current.filter((entry) => {
              if (entry.id !== row.id) return true
              if (hasSeenRow) return false
              hasSeenRow = true
              return true
            })
          })
          setRowsStatusMessage('That row is already saved.')
          return
        }
        if (!response.ok) throw new Error(`Failed to save row (${response.status})`)
        setRowsStatusMessage('')
      } catch (error) {
        console.error(`Failed to create SMS row ${row.id}:`, error)
        setRowsStatusMessage('Some SMS table changes could not be saved. Please retry.')
      }
    })()
  }

  const updateSmsRow = (row: SmsRow) => {
    setSmsRows((current) => current.map((entry) => (entry.id === row.id ? row : entry)))
    void (async () => {
      try {
        const response = await fetch(`${SMS_ROWS_API_URL}/${row.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: row.date,
            patient: row.patient,
            account: row.account,
            prescriber: row.prescriber,
            status: row.status,
            priority: row.priority,
            phone: row.phone,
          }),
        })
        if (!response.ok) throw new Error(`Failed to update row (${response.status})`)
        setRowsStatusMessage('')
      } catch (error) {
        console.error(`Failed to update SMS row ${row.id}:`, error)
        setRowsStatusMessage('Some SMS table changes could not be saved. Please retry.')
      }
    })()
  }

  const deleteSmsRow = (id: number) => {
    setSmsRows((current) => current.filter((entry) => entry.id !== id))
    void (async () => {
      try {
        const response = await fetch(`${SMS_ROWS_API_URL}/${id}`, {
          method: 'DELETE',
        })
        if (response.status === 404) {
          setRowsStatusMessage('That row was already removed from saved data.')
          return
        }
        if (!response.ok) throw new Error(`Failed to delete row (${response.status})`)
        setRowsStatusMessage('')
      } catch (error) {
        console.error(`Failed to delete SMS row ${id}:`, error)
        setRowsStatusMessage('Some SMS table changes could not be saved. Please retry.')
      }
    })()
  }

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
            <button type="button" className={buttonSecondaryClassName} onClick={() => setSelectedTool('sms-templates')}>SMS Templates</button>
          </div>
        </section>
      </main>
    )
  }

  if (selectedTool === 'medical-note') {
    return <MedicalNoteTool onBackToTools={() => setSelectedTool(null)} onAddSmsRow={createSmsRow} />
  }

  if (selectedTool === 'sms-templates') {
    return <SmsTemplatesTool onBackToTools={() => setSelectedTool(null)} templates={smsTemplates} setTemplates={setSmsTemplates} />
  }

  return (
    <SmsTableTool
      onBackToTools={() => setSelectedTool(null)}
      rows={smsRows}
      onCreateRow={createSmsRow}
      onUpdateRow={updateSmsRow}
      onDeleteRow={deleteSmsRow}
      templates={smsTemplates}
      rowsStatusMessage={rowsStatusMessage}
    />
  )
}

export default App
