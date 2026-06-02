import './App.css'

const MISSING_VALUE = '—'

type YesNo = '' | 'yes' | 'no'

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
}

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

const createSmsMarkup = () => `
  <div class="sms-workflow-page">
    <section class="sms-toolbar">
      <div>
        <h2>SMS Workflow Tracking</h2>
        <p class="sms-subtitle">Track consultation progress and outreach status.</p>
      </div>
      <button type="button" class="sms-add-button" id="sms-add-entry">Add entry</button>
    </section>

    <section class="sms-stats" aria-label="Summary stats">
      <article class="sms-stat-card">
        <span class="sms-stat-label">Total</span>
        <strong id="sms-stat-total">0</strong>
      </article>
      <article class="sms-stat-card">
        <span class="sms-stat-label">Pending</span>
        <strong id="sms-stat-pending">0</strong>
      </article>
      <article class="sms-stat-card">
        <span class="sms-stat-label">Approved</span>
        <strong id="sms-stat-approved">0</strong>
      </article>
      <article class="sms-stat-card">
        <span class="sms-stat-label">High priority</span>
        <strong id="sms-stat-high">0</strong>
      </article>
    </section>

    <section class="sms-filters" aria-label="Filters">
      <label class="sms-filter-field sms-filter-search">
        <span>Search</span>
        <input id="sms-filter-search" type="search" placeholder="Search patient or prescriber" />
      </label>
      <label class="sms-filter-field">
        <span>Status</span>
        <select id="sms-filter-status">
          <option value="">All statuses</option>
          <option value="Pending Consultation">Pending Consultation</option>
          <option value="Under Review">Under Review</option>
          <option value="Approved">Approved</option>
          <option value="Denied">Denied</option>
        </select>
      </label>
      <label class="sms-filter-field">
        <span>Priority</span>
        <select id="sms-filter-priority">
          <option value="">All priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </label>
    </section>

    <section class="sms-table-shell">
      <div class="sms-table-scroll">
        <table class="sms-table-vanilla" id="sms-table">
          <thead>
            <tr>
              <th>Date entered</th>
              <th>Patient name</th>
              <th>Client account</th>
              <th>Prescriber</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Phone number</th>
              <th class="sms-delete-col">Delete row</th>
            </tr>
          </thead>
          <tbody id="sms-table-body"></tbody>
        </table>
      </div>
      <div class="sms-empty-state" id="sms-empty-state" hidden>No rows match your filters.</div>
    </section>
  </div>
`

const initializeSmsTable = (container: HTMLElement) => {
  type SmsStatus = 'Pending Consultation' | 'Under Review' | 'Approved' | 'Denied'
  type SmsPriority = 'High' | 'Medium' | 'Low'
  type SmsRow = {
    id: number
    dateEntered: string
    patientName: string
    clientAccount: string
    prescriber: string
    status: SmsStatus
    priority: SmsPriority
    phoneNumber: string
  }

  let nextId = 2
  let rows: SmsRow[] = [
    {
      id: 1,
      dateEntered: '',
      patientName: '',
      clientAccount: '',
      prescriber: '',
      status: 'Pending Consultation',
      priority: 'Medium',
      phoneNumber: '',
    },
  ]

  let pendingFocusId: number | null = null

  const tableBody = container.querySelector<HTMLTableSectionElement>('#sms-table-body')
  const emptyState = container.querySelector<HTMLElement>('#sms-empty-state')
  const addButton = container.querySelector<HTMLButtonElement>('#sms-add-entry')
  const searchInput = container.querySelector<HTMLInputElement>('#sms-filter-search')
  const statusFilter = container.querySelector<HTMLSelectElement>('#sms-filter-status')
  const priorityFilter = container.querySelector<HTMLSelectElement>('#sms-filter-priority')

  const statTotal = container.querySelector<HTMLElement>('#sms-stat-total')
  const statPending = container.querySelector<HTMLElement>('#sms-stat-pending')
  const statApproved = container.querySelector<HTMLElement>('#sms-stat-approved')
  const statHigh = container.querySelector<HTMLElement>('#sms-stat-high')

  if (!tableBody || !emptyState || !addButton || !searchInput || !statusFilter || !priorityFilter || !statTotal || !statPending || !statApproved || !statHigh) {
    return
  }

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  const matchesFilters = (row: SmsRow) => {
    const search = searchInput.value.trim().toLowerCase()
    const status = statusFilter.value
    const priority = priorityFilter.value

    const matchesSearch =
      !search || row.patientName.toLowerCase().includes(search) || row.prescriber.toLowerCase().includes(search)
    const matchesStatus = !status || row.status === status
    const matchesPriority = !priority || row.priority === priority

    return matchesSearch && matchesStatus && matchesPriority
  }

  const createStatusBadge = (status: SmsStatus) => `<span class="sms-badge sms-badge-${status.toLowerCase().replace(/[^a-z]+/g, '-')}">${status}</span>`

  const createPriorityBadge = (priority: SmsPriority) =>
    `<span class="sms-priority"><span class="sms-priority-dot sms-priority-${priority.toLowerCase()}"></span>${priority}</span>`

  const updateStats = () => {
    statTotal.textContent = String(rows.length)
    statPending.textContent = String(rows.filter((row) => row.status === 'Pending Consultation').length)
    statApproved.textContent = String(rows.filter((row) => row.status === 'Approved').length)
    statHigh.textContent = String(rows.filter((row) => row.priority === 'High').length)
  }

  const render = () => {
    const filteredRows = rows.filter(matchesFilters)

    tableBody.innerHTML = filteredRows
      .map(
        (row) => `
          <tr data-row-id="${row.id}">
            <td>
              <input data-field="dateEntered" type="date" value="${escapeHtml(row.dateEntered)}" />
            </td>
            <td>
              <input data-field="patientName" data-focus-target="${row.id}" type="text" value="${escapeHtml(row.patientName)}" />
            </td>
            <td>
              <input data-field="clientAccount" type="text" inputmode="numeric" placeholder="ACC-1234" value="${escapeHtml(row.clientAccount)}" />
            </td>
            <td>
              <input data-field="prescriber" type="text" value="${escapeHtml(row.prescriber)}" />
            </td>
            <td>
              <label class="sms-select-wrap">
                ${createStatusBadge(row.status)}
                <select data-field="status" aria-label="Status">
                  <option value="Pending Consultation" ${row.status === 'Pending Consultation' ? 'selected' : ''}>Pending Consultation</option>
                  <option value="Under Review" ${row.status === 'Under Review' ? 'selected' : ''}>Under Review</option>
                  <option value="Approved" ${row.status === 'Approved' ? 'selected' : ''}>Approved</option>
                  <option value="Denied" ${row.status === 'Denied' ? 'selected' : ''}>Denied</option>
                </select>
              </label>
            </td>
            <td>
              <label class="sms-select-wrap">
                ${createPriorityBadge(row.priority)}
                <select data-field="priority" aria-label="Priority">
                  <option value="High" ${row.priority === 'High' ? 'selected' : ''}>High</option>
                  <option value="Medium" ${row.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                  <option value="Low" ${row.priority === 'Low' ? 'selected' : ''}>Low</option>
                </select>
              </label>
            </td>
            <td>
              <input data-field="phoneNumber" type="tel" value="${escapeHtml(row.phoneNumber)}" />
            </td>
            <td class="sms-delete-cell">
              <button type="button" class="sms-delete-button" data-action="delete" aria-label="Delete row">✕</button>
            </td>
          </tr>
        `,
      )
      .join('')

    emptyState.hidden = filteredRows.length > 0
    updateStats()

    if (pendingFocusId !== null) {
      const focusTarget = tableBody.querySelector<HTMLInputElement>(`input[data-focus-target="${pendingFocusId}"]`)
      focusTarget?.focus()
      pendingFocusId = null
    }
  }

  const updateRow = (rowId: number, field: keyof Omit<SmsRow, 'id'>, value: string) => {
    rows = rows.map((row) => {
      if (row.id !== rowId) return row
      if (field === 'clientAccount') {
        const digits = value.replace(/\D/g, '').slice(0, 4)
        return { ...row, clientAccount: digits ? `ACC-${digits}` : '' }
      }
      return { ...row, [field]: value } as SmsRow
    })
    render()
  }

  addButton.addEventListener('click', () => {
    const newRow: SmsRow = {
      id: nextId++,
      dateEntered: '',
      patientName: '',
      clientAccount: '',
      prescriber: '',
      status: 'Pending Consultation',
      priority: 'Medium',
      phoneNumber: '',
    }
    rows = [...rows, newRow]
    pendingFocusId = newRow.id
    render()
  })

  ;[searchInput, statusFilter, priorityFilter].forEach((element) => {
    element.addEventListener('input', render)
    element.addEventListener('change', render)
  })

  tableBody.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement
    const rowElement = target.closest<HTMLTableRowElement>('tr[data-row-id]')
    if (!rowElement) return
    const rowId = Number(rowElement.dataset.rowId)
    const field = target.dataset.field as keyof Omit<SmsRow, 'id'> | undefined
    if (!field) return
    updateRow(rowId, field, target.value)
  })

  tableBody.addEventListener(
    'blur',
    (event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement
      const rowElement = target.closest<HTMLTableRowElement>('tr[data-row-id]')
      if (!rowElement) return
      const rowId = Number(rowElement.dataset.rowId)
      const field = target.dataset.field as keyof Omit<SmsRow, 'id'> | undefined
      if (!field) return
      updateRow(rowId, field, target.value)
    },
    true,
  )

  tableBody.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    const deleteButton = target.closest<HTMLButtonElement>('button[data-action="delete"]')
    if (!deleteButton) return
    const rowElement = deleteButton.closest<HTMLTableRowElement>('tr[data-row-id]')
    if (!rowElement) return
    const rowId = Number(rowElement.dataset.rowId)
    rows = rows.filter((row) => row.id !== rowId)
    render()
  })

  render()
}

function App() {
  const noteText = fillTemplate(MEDICAL_NOTE_TEMPLATE, {
    'PATIENT NAME': INITIAL_FORM.patientName || MISSING_VALUE,
    AGE: getAge(INITIAL_FORM.dob),
    GENDER: INITIAL_FORM.gender || MISSING_VALUE,
    PMH: INITIAL_FORM.pmh || MISSING_VALUE,
    BMI: INITIAL_FORM.bmi || MISSING_VALUE,
    HAS_WEIGHT_LOSS_PROGRAM: getYesNoPhrase(INITIAL_FORM.hasWeightLossProgram),
    HAS_GLP1: getYesNoPhrase(INITIAL_FORM.hasGlp1),
    'LAST DOSE': INITIAL_FORM.lastDose || MISSING_VALUE,
    PSH: INITIAL_FORM.psh || MISSING_VALUE,
    Allergy: INITIAL_FORM.allergies || MISSING_VALUE,
    MEDICATION: INITIAL_FORM.medications || MISSING_VALUE,
    HEIGHT: getHeightInches(INITIAL_FORM.heightFt, INITIAL_FORM.heightIn),
    WEIGHT: INITIAL_FORM.weight || MISSING_VALUE,
    'ZEPBOUND/MONJAURO or OZEMPIC/WAGOVY': INITIAL_FORM.prescribedMedication || MISSING_VALUE,
  })

  const html = `
    <main class="app sms-fullwidth-app">
      <div class="app-header">
        <div class="tool-tabs" role="tablist" aria-label="Tools">
          <button type="button" class="tool-tab" data-tool="medical-note">Medical Note</button>
          <button type="button" class="tool-tab active" data-tool="sms-table">SMS TABLE</button>
        </div>
      </div>

      <section id="medical-note-view" hidden>
        <h1>Medical Note Template Tool</h1>
        <p class="privacy">All processing stays in your browser. No data is saved or transmitted.</p>
        <section class="preview">
          <h2>Live Preview</h2>
          <pre>${noteText}</pre>
        </section>
      </section>

      <section id="sms-table-view">
        ${createSmsMarkup()}
      </section>
    </main>
  `

  return (
    <div
      dangerouslySetInnerHTML={{
        __html: html,
      }}
      ref={(node) => {
        if (!node || node.dataset.initialized === 'true') return
        node.dataset.initialized = 'true'

        const medicalNoteView = node.querySelector<HTMLElement>('#medical-note-view')
        const smsTableView = node.querySelector<HTMLElement>('#sms-table-view')
        const tabs = Array.from(node.querySelectorAll<HTMLButtonElement>('.tool-tab'))

        tabs.forEach((tab) => {
          tab.addEventListener('click', () => {
            const tool = tab.dataset.tool
            tabs.forEach((button) => button.classList.toggle('active', button === tab))
            if (tool === 'medical-note') {
              medicalNoteView?.removeAttribute('hidden')
              smsTableView?.setAttribute('hidden', 'true')
            } else {
              smsTableView?.removeAttribute('hidden')
              medicalNoteView?.setAttribute('hidden', 'true')
            }
          })
        })

        const smsContainer = node.querySelector<HTMLElement>('.sms-workflow-page')
        if (smsContainer) initializeSmsTable(smsContainer)
      }}
    />
  )
}

export default App
