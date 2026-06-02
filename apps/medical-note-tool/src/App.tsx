import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
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

type SmsStatus = 'Received' | 'Pending Consultation' | 'Approved' | 'Cancelled' | 'Rejected' | 'Incomplete' | 'Needs Clarification' | 'Missing Forms' | 'RTS' | 'ScriptSure Error'
type SmsPriority = '1 - High' | '2 - Medium' | '3 - Normal'

type SmsRow = {
  id: number
  dateModified: string
  visitId: string
  status: SmsStatus
  note: string
  rxStatus: string
  priority: SmsPriority
  visitType: string
  clinic: string
  prescriber: string
  patient: string
  dateOfBirth: string
  phone: string
  state: string
}

type FilterState = {
  search: string
  status: '' | SmsStatus
  priority: '' | SmsPriority
  dateFrom: string
  dateTo: string
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
const NOTE_PRIORITY_OPTIONS = ['Normal', 'Rush']
const SMS_STATUS_OPTIONS: SmsStatus[] = ['Received', 'Pending Consultation', 'Approved', 'Cancelled', 'Rejected', 'Incomplete', 'Needs Clarification', 'Missing Forms', 'RTS', 'ScriptSure Error']
const SMS_PRIORITY_OPTIONS: SmsPriority[] = ['1 - High', '2 - Medium', '3 - Normal']
const RX_STATUS_OPTIONS = ['Not Received', 'Received', 'Pending', 'Sent']

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

const INITIAL_SMS_ROWS: SmsRow[] = [
  {
    id: 1,
    dateModified: '2026-06-02 09:27pm',
    visitId: '1031654',
    status: 'Received',
    note: '',
    rxStatus: 'Not Received',
    priority: '3 - Normal',
    visitType: 'Weightlossfollowup',
    clinic: 'Helimeds',
    prescriber: 'None',
    patient: 'RyeAnne Ricker',
    dateOfBirth: '1990-12-07',
    phone: '(425) 891-0704',
    state: 'CO',
  },
  {
    id: 2,
    dateModified: '2026-06-01 09:25pm',
    visitId: '1031653',
    status: 'Received',
    note: '',
    rxStatus: 'Not Received',
    priority: '3 - Normal',
    visitType: 'Weightlossfollowup',
    clinic: 'Helimeds',
    prescriber: 'None',
    patient: 'Karina Ferdynus',
    dateOfBirth: '1979-11-07',
    phone: '(312) 720-3212',
    state: 'IL',
  },
  {
    id: 3,
    dateModified: '2026-06-01 09:07pm',
    visitId: '1031650',
    status: 'Needs Clarification',
    note: '',
    rxStatus: 'Not Received',
    priority: '1 - High',
    visitType: 'Weight Management Follow Up',
    clinic: 'Clinic Secret',
    prescriber: 'None',
    patient: 'Nirav Shah',
    dateOfBirth: '1976-08-28',
    phone: '(706) 871-0210',
    state: 'GA',
  },
]

const INITIAL_FILTERS: FilterState = {
  search: '',
  status: '',
  priority: '',
  dateFrom: '2026-05-29',
  dateTo: '2026-06-02',
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

const statusClassName: Record<SmsStatus, string> = {
  Received: 'sms-chip',
  'Pending Consultation': 'sms-chip',
  Approved: 'sms-chip',
  Cancelled: 'sms-chip',
  Rejected: 'sms-chip',
  Incomplete: 'sms-chip',
  'Needs Clarification': 'sms-chip',
  'Missing Forms': 'sms-chip',
  RTS: 'sms-chip',
  'ScriptSure Error': 'sms-chip',
}

const formatDateEntered = () => new Date().toISOString().slice(0, 16).replace('T', ' ')
const createVisitId = (id: number) => String(1032000 + id)
const mapNotePriorityToSmsPriority = (value: string): SmsPriority => (value === 'Rush' ? '1 - High' : '3 - Normal')
const formatClinicFromAccount = (value: string) => (value ? value.replaceAll('_', ' ') : '')

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
      onAddSmsRow({
        id: Date.now(),
        dateModified: formatDateEntered(),
        visitId: createVisitId(Date.now() % 1000),
        status: 'Pending Consultation',
        note: '',
        rxStatus: 'Not Received',
        priority: mapNotePriorityToSmsPriority(formData.priority),
        visitType: 'Weightlossfollowup',
        clinic: formatClinicFromAccount(formData.account),
        prescriber: formData.prescriber || 'None',
        patient: formData.patientName,
        dateOfBirth: formData.dob,
        phone: formData.phone,
        state: '',
      })
      setCopyFeedback('Note copied and added to SMS table.')
    } catch {
      setCopyFeedback('Unable to copy note. Please copy manually from the preview.')
    }
  }

  return (
    <main className="app">
      <div className="app-header">
        <button type="button" className="secondary" onClick={onBackToTools}>Back to tools</button>
      </div>
      <h1>Medical Note Template Tool</h1>
      <p className="privacy">All processing stays in your browser. No data is saved or transmitted.</p>
      <div className="layout">
        <form className="form" onSubmit={(event) => event.preventDefault()}>
          <label>Patient Name<input value={formData.patientName} onChange={(event) => updateField('patientName', event.target.value)} /></label>
          <label>Date of Birth<input type="date" value={formData.dob} onChange={(event) => updateField('dob', event.target.value)} /></label>
          <label>Phone Number<input value={formData.phone} onChange={(event) => updateField('phone', event.target.value)} /></label>
          <fieldset>
            <legend>Gender</legend>
            <label className="inline"><input type="radio" name="gender" checked={formData.gender === 'Male'} onChange={() => updateField('gender', 'Male')} />Male</label>
            <label className="inline"><input type="radio" name="gender" checked={formData.gender === 'Female'} onChange={() => updateField('gender', 'Female')} />Female</label>
          </fieldset>
          <div className="inline-grid">
            <label>Height (ft)<input type="number" min="0" value={formData.heightFt} onChange={(event) => updateField('heightFt', event.target.value)} /></label>
            <label>Height (in)<input type="number" min="0" value={formData.heightIn} onChange={(event) => updateField('heightIn', event.target.value)} /></label>
          </div>
          <label>Weight (lbs)<input type="number" min="0" value={formData.weight} onChange={(event) => updateField('weight', event.target.value)} /></label>
          <label>BMI<input value={formData.bmi} onChange={(event) => updateField('bmi', event.target.value)} /></label>
          <label>Allergies<textarea value={formData.allergies} onChange={(event) => updateField('allergies', event.target.value)} /></label>
          <label>Past Medical History (PMH)<textarea value={formData.pmh} onChange={(event) => updateField('pmh', event.target.value)} /></label>
          <label>Past Surgical History (PSH)<textarea value={formData.psh} onChange={(event) => updateField('psh', event.target.value)} /></label>
          <label>Current Medications<textarea value={formData.medications} onChange={(event) => updateField('medications', event.target.value)} /></label>
          <fieldset>
            <legend>Previous Weight Loss Programs</legend>
            <label className="inline"><input type="radio" name="weight-loss" checked={formData.hasWeightLossProgram === 'yes'} onChange={() => updateField('hasWeightLossProgram', 'yes')} />Yes</label>
            <label className="inline"><input type="radio" name="weight-loss" checked={formData.hasWeightLossProgram === 'no'} onChange={() => updateField('hasWeightLossProgram', 'no')} />No</label>
          </fieldset>
          <fieldset>
            <legend>Previous GLP-1 Medication Use</legend>
            <label className="inline"><input type="radio" name="glp1" checked={formData.hasGlp1 === 'yes'} onChange={() => updateField('hasGlp1', 'yes')} />Yes</label>
            <label className="inline"><input type="radio" name="glp1" checked={formData.hasGlp1 === 'no'} onChange={() => updateField('hasGlp1', 'no')} />No</label>
          </fieldset>
          <label>Last Dose of GLP-1 or Weight-Loss Medication<input value={formData.lastDose} onChange={(event) => updateField('lastDose', event.target.value)} /></label>
          <label>Account / Client<select value={formData.account} onChange={(event) => updateField('account', event.target.value)}><option value="">Select an account</option>{ACCOUNT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label>Prescriber<select value={formData.prescriber} onChange={(event) => updateField('prescriber', event.target.value)}><option value="">Select a prescriber</option>{PRESCRIBER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label>Medication Being Prescribed<select value={formData.prescribedMedication} onChange={(event) => updateField('prescribedMedication', event.target.value)}><option value="">Select medication</option>{MEDICATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label>Priority<select value={formData.priority} onChange={(event) => updateField('priority', event.target.value)}>{NOTE_PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <div className="button-row">
            <button type="button" onClick={handleCopy}>Copy Note</button>
            <button type="button" onClick={handleSmsAndCopy}>SMS & Copy</button>
          </div>
          {copyFeedback && <p className="feedback">{copyFeedback}</p>}
        </form>
        <section className="preview"><h2>Live Preview</h2><pre>{noteText}</pre></section>
      </div>
    </main>
  )
}

function SmsTableTool({ onBackToTools, rows, setRows }: { onBackToTools: () => void; rows: SmsRow[]; setRows: React.Dispatch<React.SetStateAction<SmsRow[]>> }) {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)
  const [entriesPerPage, setEntriesPerPage] = useState('25')
  const nextIdRef = useRef(Math.max(0, ...rows.map((row) => row.id)) + 1)
  const patientInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesSearch = !search || row.patient.toLowerCase().includes(search) || row.prescriber.toLowerCase().includes(search)
      const matchesStatus = !filters.status || row.status === filters.status
      const matchesPriority = !filters.priority || row.priority === filters.priority
      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [filters, rows])

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((row) => row.status === 'Pending Consultation').length,
    approved: rows.filter((row) => row.status === 'Approved').length,
    highPriority: rows.filter((row) => row.priority === '1 - High').length,
  }), [rows])

  const updateRow = <K extends keyof Omit<SmsRow, 'id'>>(rowId: number, field: K, value: SmsRow[K]) => {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)))
  }

  const handleTextChange = (rowId: number, field: keyof Pick<SmsRow, 'dateModified' | 'visitId' | 'note' | 'visitType' | 'clinic' | 'patient' | 'dateOfBirth' | 'phone' | 'state'>) =>
    (event: ChangeEvent<HTMLInputElement>) => updateRow(rowId, field, event.target.value)

  const handleSelectChange = (rowId: number, field: 'status' | 'priority' | 'rxStatus' | 'prescriber') =>
    (event: ChangeEvent<HTMLSelectElement>) => updateRow(rowId, field, event.target.value as SmsRow[typeof field])

  const handleAddEntry = () => {
    const id = nextIdRef.current++
    setRows((current) => [...current, {
      id,
      dateModified: formatDateEntered(),
      visitId: createVisitId(id),
      status: 'Received',
      note: '',
      rxStatus: 'Not Received',
      priority: '3 - Normal',
      visitType: 'Weightlossfollowup',
      clinic: 'Helimeds',
      prescriber: 'None',
      patient: '',
      dateOfBirth: '',
      phone: '',
      state: '',
    }])
    requestAnimationFrame(() => patientInputRefs.current[id]?.focus())
  }

  const handleSearchVisits = (event: FormEvent) => event.preventDefault()

  return (
    <main className="app emed-app">
      <aside className="emed-sidebar">
        <div className="emed-brand">eMedical Health</div>
        <nav>
          <div className="emed-nav-section">TASKS</div>
          <a className="emed-nav-link">My Tasks</a>
          <div className="emed-nav-section">EMED</div>
          <a className="emed-nav-link">Script Search</a>
          <a className="emed-nav-link">Clinic Files</a>
          <a className="emed-nav-link active">SMS Messages</a>
          <div className="emed-nav-section">CLINIC PORTAL</div>
          <a className="emed-nav-link">Visits</a>
          <a className="emed-nav-link">Prescriptions</a>
          <a className="emed-nav-link">Documents</a>
        </nav>
      </aside>
      <div className="emed-content">
        <div className="app-header emed-topbar">
          <button type="button" className="secondary" onClick={onBackToTools}>Back to tools</button>
        </div>

        <section className="sms-hero-panel">
          <div className="sms-hero-title">VISIT STATUS</div>
          <div className="sms-chip-row">
            {SMS_STATUS_OPTIONS.map((status) => <button key={status} type="button" className={statusClassName[status]} onClick={() => setFilters((current) => ({ ...current, status }))}>{status}</button>)}
          </div>
          <form className="sms-date-row" onSubmit={handleSearchVisits}>
            <div className="sms-date-title">DATE RANGE</div>
            <label>From:<input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
            <label>To:<input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} /></label>
            <button type="submit" className="sms-search-button">Search Visits</button>
            <button type="button" className="sms-reset-button" onClick={() => setFilters(INITIAL_FILTERS)}>Reset</button>
          </form>
        </section>

        <section className="sms-table-card">
          <header className="sms-table-card-header">
            <div>
              <strong>MOCT Visits [{stats.total}]</strong>
              <span className="sms-export-pill">Excel</span>
            </div>
          </header>

          <div className="sms-stats sms-stats-compact" aria-label="Summary stats">
            <article className="sms-stat-card"><span className="sms-stat-label">Total</span><strong>{stats.total}</strong></article>
            <article className="sms-stat-card"><span className="sms-stat-label">Pending</span><strong>{stats.pending}</strong></article>
            <article className="sms-stat-card"><span className="sms-stat-label">Approved</span><strong>{stats.approved}</strong></article>
            <article className="sms-stat-card"><span className="sms-stat-label">High priority</span><strong>{stats.highPriority}</strong></article>
          </div>

          <div className="sms-table-toolbar">
            <div className="sms-entries-control">
              <select value={entriesPerPage} onChange={(event) => setEntriesPerPage(event.target.value)}>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <span>entries per page</span>
            </div>
            <div className="sms-toolbar-actions">
              <button type="button" className="sms-add-inline" onClick={handleAddEntry}>Add +</button>
              <input className="sms-search-input" placeholder="Search..." value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
            </div>
          </div>

          <div className="sms-table-scroll">
            <table className="sms-table sms-table-emed" aria-label="SMS workflow tracking table">
              <thead>
                <tr>
                  <th>Date Modified</th>
                  <th>Visit Id</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th>Rx Status</th>
                  <th>Priority</th>
                  <th>Visit Type</th>
                  <th>Clinic</th>
                  <th>Prescriber</th>
                  <th>Patient</th>
                  <th>Date Of Birth</th>
                  <th>Phone</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td><input value={row.dateModified} onChange={handleTextChange(row.id, 'dateModified')} /></td>
                    <td><input value={row.visitId} onChange={handleTextChange(row.id, 'visitId')} /></td>
                    <td><select value={row.status} onChange={handleSelectChange(row.id, 'status')}>{SMS_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
                    <td><input value={row.note} onChange={handleTextChange(row.id, 'note')} /></td>
                    <td><select value={row.rxStatus} onChange={handleSelectChange(row.id, 'rxStatus')}>{RX_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                    <td><select value={row.priority} onChange={handleSelectChange(row.id, 'priority')}>{SMS_PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></td>
                    <td><input value={row.visitType} onChange={handleTextChange(row.id, 'visitType')} /></td>
                    <td><input value={row.clinic} onChange={handleTextChange(row.id, 'clinic')} /></td>
                    <td><select value={row.prescriber} onChange={handleSelectChange(row.id, 'prescriber')}><option value="None">None</option>{PRESCRIBER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                    <td><input ref={(node) => { patientInputRefs.current[row.id] = node }} value={row.patient} onChange={handleTextChange(row.id, 'patient')} /></td>
                    <td><input type="date" value={row.dateOfBirth} onChange={handleTextChange(row.id, 'dateOfBirth')} /></td>
                    <td><input value={row.phone} onChange={handleTextChange(row.id, 'phone')} /></td>
                    <td><input value={row.state} onChange={handleTextChange(row.id, 'state')} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRows.length === 0 && <div className="sms-empty-state">No rows match your filters.</div>}
        </section>
      </div>
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
      <main className="app gate-page">
        <section className="gate-card">
          <h1>BirkeHealth Tools</h1>
          <p className="privacy">Enter the access code to continue. This gate is client-side only and should not be treated as secure authentication.</p>
          <form onSubmit={handleAccessSubmit} className="gate-form">
            <label>Access Code
              <input value={accessCode} onChange={(event) => { setAccessError(''); setAccessCode(event.target.value) }} />
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
            <button type="button" onClick={() => setSelectedTool('medical-note')}>Medical Note</button>
            <button type="button" onClick={() => setSelectedTool('sms-table')}>SMS TABLE</button>
          </div>
        </section>
      </main>
    )
  }

  if (selectedTool === 'medical-note') {
    return <MedicalNoteTool onBackToTools={() => setSelectedTool(null)} onAddSmsRow={(row) => setSmsRows((current) => [row, ...current])} />
  }

  return <SmsTableTool onBackToTools={() => setSelectedTool(null)} rows={smsRows} setRows={setSmsRows} />
}

export default App
