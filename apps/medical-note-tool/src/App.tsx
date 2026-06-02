import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

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
  | 'Pending Consultation'
  | 'Approved by prescriber'
  | 'Notified'
  | '2nd text sent'
  | 'Replied to 2nd text'
  | 'Replied yes'
  | 'Completed'
  | 'Text Failed'

type SmsTableRow = {
  dateEntered: string
  patientName: string
  clientAccount: string
  prescriber: string
  status: SmsStatus
  priority: string
  phoneNumber: string
  cleanedNumber: string
  secondTextResponse: string
}

const ACCOUNT_OPTIONS = [
  'DORAL ACUPUNCTURE',
  'HELIMEDS',
  'PEAKS CURATIVE',
  'CLINIC SECRET',
  'TRUE LIO',
  'WHITECOAT MD',
]

const PRESCRIBER_OPTIONS = [
  'ALBERTO NUNEZ PINA',
  'YADIRA JEAN-LOUIS',
  'LUK JEAN-LOUIS',
  'EMILIO LUIS GONZALEZ',
  'CHARLES SAROSY',
  'ELIAZER MORGAN',
]

const MEDICATION_OPTIONS = ['OZEMPIC/WAGOVY', 'ZEPBOUND/MONJAURO']

const PRIORITY_OPTIONS = ['Normal', 'Rush']

const SMS_STATUS_OPTIONS: SmsStatus[] = [
  'Pending Consultation',
  'Approved by prescriber',
  'Notified',
  '2nd text sent',
  'Replied to 2nd text',
  'Replied yes',
  'Completed',
  'Text Failed',
]

const INITIAL_SMS_ROW: SmsTableRow = {
  dateEntered: '',
  patientName: '',
  clientAccount: '',
  prescriber: '',
  status: 'Pending Consultation',
  priority: '',
  phoneNumber: '',
  cleanedNumber: '',
  secondTextResponse: '',
}

const INITIAL_SMS_ROWS: SmsTableRow[] = [{ ...INITIAL_SMS_ROW }]

const INITIAL_FORM: FormData = {
  patientName: '',
  dob: '',
  phone: '',
  gender: '',
  heightFt: '',
  heightIn: '',
  weight: '',
  bmi: '',
  allergies: '',
  pmh: '',
  psh: '',
  medications: '',
  hasWeightLossProgram: '',
  hasGlp1: '',
  lastDose: '',
  account: '',
  prescriber: '',
  prescribedMedication: '',
  priority: 'Normal',
}

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

const MISSING_VALUE = '—'
const TEMPORARY_ACCESS_CODE = 'MOC0813'

const formatDateEntered = (): string => {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const year = String(today.getFullYear())
  return `${month}/${day}/${year}`
}

const getCleanedNumber = (phone: string): string => phone.replace(/\D/g, '')

const getAge = (dob: string): string => {
  if (!dob) return MISSING_VALUE

  const birthDate = new Date(dob)
  if (Number.isNaN(birthDate.getTime())) return MISSING_VALUE

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDifference = today.getMonth() - birthDate.getMonth()
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1
  }

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
  Object.entries(values).reduce((result, [key, value]) => {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    return result.replace(pattern, value || MISSING_VALUE)
  }, template)

type MedicalNoteToolProps = {
  onBackToTools: () => void
  onAddSmsRow: (row: SmsTableRow) => void
}

function MedicalNoteTool({ onBackToTools, onAddSmsRow }: MedicalNoteToolProps) {
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

  const handleReset = (event: FormEvent) => {
    event.preventDefault()
    setFormData(INITIAL_FORM)
    setCopyFeedback('Form reset. No data retained.')
  }

  const copyNoteToClipboard = async () => {
    await navigator.clipboard.writeText(noteText)
  }

  const handleCopy = async (event: FormEvent) => {
    event.preventDefault()

    try {
      await copyNoteToClipboard()
      setCopyFeedback('Note copied to clipboard.')
    } catch {
      setCopyFeedback('Unable to copy note. Please copy manually from the preview.')
    }
  }

  const handleSmsAndCopy = async (event: FormEvent) => {
    event.preventDefault()

    try {
      await copyNoteToClipboard()

      onAddSmsRow({
        dateEntered: formatDateEntered(),
        patientName: formData.patientName,
        clientAccount: formData.account,
        prescriber: formData.prescriber,
        status: 'Pending Consultation',
        priority: formData.priority,
        phoneNumber: formData.phone,
        cleanedNumber: getCleanedNumber(formData.phone),
        secondTextResponse: '',
      })

      setCopyFeedback('Note copied and SMS TABLE updated.')
    } catch {
      setCopyFeedback('Unable to copy note. Please copy manually from the preview.')
    }
  }

  return (
    <main className="app">
      <div className="app-header">
        <button type="button" className="secondary" onClick={onBackToTools}>
          Back to tools
        </button>
      </div>
      <h1>Medical Note Template Tool</h1>
      <p className="privacy">All processing stays in your browser. No data is saved or transmitted.</p>

      <div className="layout">
        <form className="form" onSubmit={(event) => event.preventDefault()}>
          <label>
            Patient Name
            <input value={formData.patientName} onChange={(event) => updateField('patientName', event.target.value)} />
          </label>

          <label>
            Date of Birth
            <input type="date" value={formData.dob} onChange={(event) => updateField('dob', event.target.value)} />
          </label>

          <label>
            Phone Number
            <input value={formData.phone} onChange={(event) => updateField('phone', event.target.value)} />
          </label>

          <fieldset>
            <legend>Gender</legend>
            <label className="inline">
              <input
                type="radio"
                name="gender"
                checked={formData.gender === 'Male'}
                onChange={() => updateField('gender', 'Male')}
              />
              Male
            </label>
            <label className="inline">
              <input
                type="radio"
                name="gender"
                checked={formData.gender === 'Female'}
                onChange={() => updateField('gender', 'Female')}
              />
              Female
            </label>
          </fieldset>

          <div className="inline-grid">
            <label>
              Height (ft)
              <input
                type="number"
                min="0"
                value={formData.heightFt}
                onChange={(event) => updateField('heightFt', event.target.value)}
              />
            </label>
            <label>
              Height (in)
              <input
                type="number"
                min="0"
                value={formData.heightIn}
                onChange={(event) => updateField('heightIn', event.target.value)}
              />
            </label>
          </div>

          <label>
            Weight (lbs)
            <input type="number" min="0" value={formData.weight} onChange={(event) => updateField('weight', event.target.value)} />
          </label>

          <label>
            BMI
            <input value={formData.bmi} onChange={(event) => updateField('bmi', event.target.value)} />
          </label>

          <label>
            Allergies
            <textarea value={formData.allergies} onChange={(event) => updateField('allergies', event.target.value)} />
          </label>

          <label>
            Past Medical History (PMH)
            <textarea value={formData.pmh} onChange={(event) => updateField('pmh', event.target.value)} />
          </label>

          <label>
            Past Surgical History (PSH)
            <textarea value={formData.psh} onChange={(event) => updateField('psh', event.target.value)} />
          </label>

          <label>
            Current Medications
            <textarea value={formData.medications} onChange={(event) => updateField('medications', event.target.value)} />
          </label>

          <fieldset>
            <legend>Previous Weight Loss Programs</legend>
            <label className="inline">
              <input
                type="radio"
                name="weight-loss"
                checked={formData.hasWeightLossProgram === 'yes'}
                onChange={() => updateField('hasWeightLossProgram', 'yes')}
              />
              Yes
            </label>
            <label className="inline">
              <input
                type="radio"
                name="weight-loss"
                checked={formData.hasWeightLossProgram === 'no'}
                onChange={() => updateField('hasWeightLossProgram', 'no')}
              />
              No
            </label>
          </fieldset>

          <fieldset>
            <legend>Previous GLP-1 Medication Use</legend>
            <label className="inline">
              <input
                type="radio"
                name="glp1"
                checked={formData.hasGlp1 === 'yes'}
                onChange={() => updateField('hasGlp1', 'yes')}
              />
              Yes
            </label>
            <label className="inline">
              <input
                type="radio"
                name="glp1"
                checked={formData.hasGlp1 === 'no'}
                onChange={() => updateField('hasGlp1', 'no')}
              />
              No
            </label>
          </fieldset>

          <label>
            Last Dose of GLP-1 or Weight-Loss Medication
            <input value={formData.lastDose} onChange={(event) => updateField('lastDose', event.target.value)} />
          </label>

          <label>
            Account / Client
            <select value={formData.account} onChange={(event) => updateField('account', event.target.value)}>
              <option value="">Select an account</option>
              {ACCOUNT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            Prescriber
            <select value={formData.prescriber} onChange={(event) => updateField('prescriber', event.target.value)}>
              <option value="">Select a prescriber</option>
              {PRESCRIBER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            Medication Being Prescribed
            <select
              value={formData.prescribedMedication}
              onChange={(event) => updateField('prescribedMedication', event.target.value)}
            >
              <option value="">Select medication</option>
              {MEDICATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            Priority
            <select value={formData.priority} onChange={(event) => updateField('priority', event.target.value)}>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="button-row">
            <button type="button" onClick={handleCopy}>
              Copy Note
            </button>
            <button type="button" onClick={handleSmsAndCopy}>
              SMS & Copy
            </button>
            <button type="button" onClick={handleReset} className="secondary">
              Reset Form
            </button>
          </div>
          {copyFeedback && <p className="feedback">{copyFeedback}</p>}
        </form>

        <section className="preview">
          <h2>Live Preview</h2>
          <pre>{noteText}</pre>
        </section>
      </div>
    </main>
  )
}

type SmsTableToolProps = {
  onBackToTools: () => void
  rows: SmsTableRow[]
  onUpdateRow: (index: number, key: keyof SmsTableRow, value: string) => void
}

function SmsTableTool({ onBackToTools, rows, onUpdateRow }: SmsTableToolProps) {
  return (
    <main className="app sms-app">
      <div className="app-header">
        <button type="button" className="secondary" onClick={onBackToTools}>
          Back to tools
        </button>
      </div>
      <h1>SMS TABLE</h1>
      <p className="privacy">Use this table to track SMS workflow details.</p>

      <section className="preview sms-table-section">
        <table className="sms-table">
          <colgroup>
            <col style={{ width: '9%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Date Entered</th>
              <th>Patient Name</th>
              <th>Client Account</th>
              <th>Prescriber</th>
              <th>Status (e.g., Pending, Approved)</th>
              <th>What is the Priority?</th>
              <th>Phone Number</th>
              <th>Cleaned Number</th>
              <th>2nd Text Response</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.patientName}-${index}`}>
                <td>
                  <input value={row.dateEntered} onChange={(event) => onUpdateRow(index, 'dateEntered', event.target.value)} />
                </td>
                <td>
                  <input value={row.patientName} onChange={(event) => onUpdateRow(index, 'patientName', event.target.value)} />
                </td>
                <td>
                  <input value={row.clientAccount} onChange={(event) => onUpdateRow(index, 'clientAccount', event.target.value)} />
                </td>
                <td>
                  <input value={row.prescriber} onChange={(event) => onUpdateRow(index, 'prescriber', event.target.value)} />
                </td>
                <td>
                  <select value={row.status} onChange={(event) => onUpdateRow(index, 'status', event.target.value)}>
                    {SMS_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input value={row.priority} onChange={(event) => onUpdateRow(index, 'priority', event.target.value)} />
                </td>
                <td>
                  <input value={row.phoneNumber} onChange={(event) => onUpdateRow(index, 'phoneNumber', event.target.value)} />
                </td>
                <td>
                  <input value={row.cleanedNumber} onChange={(event) => onUpdateRow(index, 'cleanedNumber', event.target.value)} />
                </td>
                <td>
                  <input
                    value={row.secondTextResponse}
                    onChange={(event) => onUpdateRow(index, 'secondTextResponse', event.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}

function App() {
  const [accessCode, setAccessCode] = useState('')
  const [accessError, setAccessError] = useState('')
  const [isAccessGranted, setIsAccessGranted] = useState(false)
  const [selectedTool, setSelectedTool] = useState<ToolSelection>(null)
  const [smsRows, setSmsRows] = useState<SmsTableRow[]>(INITIAL_SMS_ROWS)

  const handleAccessSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (accessCode.trim().toUpperCase() === TEMPORARY_ACCESS_CODE) {
      setAccessError('')
      setIsAccessGranted(true)
      return
    }

    setAccessError('Invalid access code. Please try again.')
  }

  const handleAddSmsRow = (row: SmsTableRow) => {
    setSmsRows((current) => [...current, row])
    setSelectedTool('sms-table')
  }

  const handleUpdateSmsRow = (index: number, key: keyof SmsTableRow, value: string) => {
    setSmsRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row

        const updatedRow = { ...row, [key]: value }

        if (key === 'phoneNumber') {
          updatedRow.cleanedNumber = getCleanedNumber(value)
        }

        return updatedRow
      }),
    )
  }

  if (!isAccessGranted) {
    return (
      <main className="app gate-page">
        <section className="gate-card">
          <h1>BirkeHealth Tools</h1>
          <p className="privacy">
            Enter the access code to continue. This gate is client-side only and should not be treated as secure authentication.
          </p>
          <form onSubmit={handleAccessSubmit} className="gate-form">
            <label>
              Access Code
              <input
                value={accessCode}
                onChange={(event) => {
                  setAccessError('')
                  setAccessCode(event.target.value)
                }}
              />
            </label>
            <button type="submit">Continue</button>
          </form>
          {accessError && <p className="feedback">{accessError}</p>}
        </section>
      </main>
    )
  }

  if (selectedTool === null) {
    return (
      <main className="app gate-page">
        <section className="gate-card">
          <h1>Select a Tool</h1>
          <p className="privacy">Choose a tool to open.</p>
          <div className="tool-list">
            <button type="button" onClick={() => setSelectedTool('medical-note')}>
              Medical Note
            </button>
            <button type="button" onClick={() => setSelectedTool('sms-table')}>
              SMS TABLE
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (selectedTool === 'sms-table') {
    return <SmsTableTool onBackToTools={() => setSelectedTool(null)} rows={smsRows} onUpdateRow={handleUpdateSmsRow} />
  }

  return <MedicalNoteTool onBackToTools={() => setSelectedTool(null)} onAddSmsRow={handleAddSmsRow} />
}

export default App
