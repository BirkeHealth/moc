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

const SMS_TABLE_HEADERS = [
  'Date Entered',
  'Patient Name',
  'Client Account',
  'Prescriber',
  'Status (e.g., Pending, Approved)',
  'What is the Priority?',
  'Phone Number',
  'Cleaned Number',
  '2nd Text Response',
] as const

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
// Frontend-only temporary gate for static hosting. This is not secure authentication
// and should be replaced by server-side auth before any sensitive use.
const TEMPORARY_ACCESS_CODE = 'MOC0813'

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

function MedicalNoteTool({ onBackToTools }: { onBackToTools: () => void }) {
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

  const handleCopy = async (event: FormEvent) => {
    event.preventDefault()

    try {
      await navigator.clipboard.writeText(noteText)
      setCopyFeedback('Note copied to clipboard.')
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

function SmsTableTool({ onBackToTools }: { onBackToTools: () => void }) {
  return (
    <main className="app">
      <div className="app-header">
        <button type="button" className="secondary" onClick={onBackToTools}>
          Back to tools
        </button>
      </div>
      <h1>SMS TABLE</h1>
      <p className="privacy">Use this table to track SMS workflow details.</p>

      <section className="preview sms-table-section">
        <div className="table-scroll">
          <table className="sms-table">
            <thead>
              <tr>
                {SMS_TABLE_HEADERS.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {SMS_TABLE_HEADERS.map((header) => (
                  <td key={header}>—</td>
                ))}
              </tr>
            </tbody>
          </table>
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
    return <SmsTableTool onBackToTools={() => setSelectedTool(null)} />
  }

  return <MedicalNoteTool onBackToTools={() => setSelectedTool(null)} />
}

export default App
