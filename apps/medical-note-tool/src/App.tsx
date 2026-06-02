import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FocusEvent } from 'react'
import './App.css'

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

type FilterState = {
  search: string
  status: '' | SmsStatus
  priority: '' | SmsPriority
}

const STATUS_OPTIONS: SmsStatus[] = ['Pending Consultation', 'Under Review', 'Approved', 'Denied']
const PRIORITY_OPTIONS: SmsPriority[] = ['High', 'Medium', 'Low']

const INITIAL_ROWS: SmsRow[] = [
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

const INITIAL_FILTERS: FilterState = {
  search: '',
  status: '',
  priority: '',
}

const statusClassName: Record<SmsStatus, string> = {
  'Pending Consultation': 'sms-badge sms-badge-pending-consultation',
  'Under Review': 'sms-badge sms-badge-under-review',
  Approved: 'sms-badge sms-badge-approved',
  Denied: 'sms-badge sms-badge-denied',
}

const priorityDotClassName: Record<SmsPriority, string> = {
  High: 'sms-priority-dot sms-priority-high',
  Medium: 'sms-priority-dot sms-priority-medium',
  Low: 'sms-priority-dot sms-priority-low',
}

const formatAccount = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  return digits ? `ACC-${digits}` : ''
}

function App() {
  const [rows, setRows] = useState<SmsRow[]>(INITIAL_ROWS)
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)
  const nextIdRef = useRef(2)
  const patientInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase()

    return rows.filter((row) => {
      const matchesSearch =
        !search || row.patientName.toLowerCase().includes(search) || row.prescriber.toLowerCase().includes(search)
      const matchesStatus = !filters.status || row.status === filters.status
      const matchesPriority = !filters.priority || row.priority === filters.priority

      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [filters, rows])

  const stats = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((row) => row.status === 'Pending Consultation').length,
      approved: rows.filter((row) => row.status === 'Approved').length,
      highPriority: rows.filter((row) => row.priority === 'High').length,
    }),
    [rows],
  )

  const updateRow = <K extends keyof Omit<SmsRow, 'id'>>(rowId: number, field: K, value: SmsRow[K]) => {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row
        return { ...row, [field]: field === 'clientAccount' ? formatAccount(String(value)) : value }
      }),
    )
  }

  const handleTextChange = (rowId: number, field: 'dateEntered' | 'patientName' | 'clientAccount' | 'prescriber' | 'phoneNumber') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = field === 'clientAccount' ? formatAccount(event.target.value) : event.target.value
      updateRow(rowId, field, nextValue)
    }

  const handleSelectChange = (rowId: number, field: 'status' | 'priority') => (event: ChangeEvent<HTMLSelectElement>) => {
    updateRow(rowId, field, event.target.value as SmsRow[typeof field])
  }

  const handleBlur = (rowId: number, field: 'dateEntered' | 'patientName' | 'clientAccount' | 'prescriber' | 'phoneNumber') =>
    (event: FocusEvent<HTMLInputElement>) => {
      const nextValue = field === 'clientAccount' ? formatAccount(event.target.value) : event.target.value
      updateRow(rowId, field, nextValue)
    }

  const handleAddEntry = () => {
    const id = nextIdRef.current++
    setRows((current) => [
      ...current,
      {
        id,
        dateEntered: '',
        patientName: '',
        clientAccount: '',
        prescriber: '',
        status: 'Pending Consultation',
        priority: 'Medium',
        phoneNumber: '',
      },
    ])

    requestAnimationFrame(() => {
      patientInputRefs.current[id]?.focus()
    })
  }

  const handleDeleteRow = (rowId: number) => {
    setRows((current) => current.filter((row) => row.id !== rowId))
    delete patientInputRefs.current[rowId]
  }

  return (
    <main className="sms-page">
      <section className="sms-toolbar">
        <div>
          <h1>SMS Workflow Tracking</h1>
          <p className="sms-subtitle">Track consultation progress and outreach status.</p>
        </div>
        <button type="button" className="sms-add-button" onClick={handleAddEntry}>
          Add entry
        </button>
      </section>

      <section className="sms-stats" aria-label="Summary stats">
        <article className="sms-stat-card">
          <span className="sms-stat-label">Total</span>
          <strong>{stats.total}</strong>
        </article>
        <article className="sms-stat-card">
          <span className="sms-stat-label">Pending</span>
          <strong>{stats.pending}</strong>
        </article>
        <article className="sms-stat-card">
          <span className="sms-stat-label">Approved</span>
          <strong>{stats.approved}</strong>
        </article>
        <article className="sms-stat-card">
          <span className="sms-stat-label">High priority</span>
          <strong>{stats.highPriority}</strong>
        </article>
      </section>

      <section className="sms-filters" aria-label="Filters">
        <label className="sms-filter-field sms-filter-search">
          <span>Search</span>
          <input
            type="search"
            placeholder="Search patient or prescriber"
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          />
        </label>

        <label className="sms-filter-field">
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as FilterState['status'] }))}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="sms-filter-field">
          <span>Priority</span>
          <select
            value={filters.priority}
            onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as FilterState['priority'] }))}
          >
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="sms-table-shell">
        <div className="sms-table-scroll">
          <table className="sms-table" aria-label="SMS workflow tracking table">
            <thead>
              <tr>
                <th>Date entered</th>
                <th>Patient name</th>
                <th>Client account</th>
                <th>Prescriber</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Phone number</th>
                <th className="sms-delete-col">Delete row</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input type="date" value={row.dateEntered} onChange={handleTextChange(row.id, 'dateEntered')} onBlur={handleBlur(row.id, 'dateEntered')} />
                  </td>
                  <td>
                    <input
                      ref={(node) => {
                        patientInputRefs.current[row.id] = node
                      }}
                      type="text"
                      value={row.patientName}
                      onChange={handleTextChange(row.id, 'patientName')}
                      onBlur={handleBlur(row.id, 'patientName')}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="ACC-1234"
                      value={row.clientAccount}
                      onChange={handleTextChange(row.id, 'clientAccount')}
                      onBlur={handleBlur(row.id, 'clientAccount')}
                    />
                  </td>
                  <td>
                    <input type="text" value={row.prescriber} onChange={handleTextChange(row.id, 'prescriber')} onBlur={handleBlur(row.id, 'prescriber')} />
                  </td>
                  <td>
                    <div className="sms-select-wrap">
                      <span className={statusClassName[row.status]}>{row.status}</span>
                      <select value={row.status} onChange={handleSelectChange(row.id, 'status')}>
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>
                    <div className="sms-select-wrap">
                      <span className="sms-priority">
                        <span className={priorityDotClassName[row.priority]} />
                        {row.priority}
                      </span>
                      <select value={row.priority} onChange={handleSelectChange(row.id, 'priority')}>
                        {PRIORITY_OPTIONS.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>
                    <input type="tel" value={row.phoneNumber} onChange={handleTextChange(row.id, 'phoneNumber')} onBlur={handleBlur(row.id, 'phoneNumber')} />
                  </td>
                  <td className="sms-delete-cell">
                    <button type="button" className="sms-delete-button" aria-label="Delete row" onClick={() => handleDeleteRow(row.id)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRows.length === 0 && <div className="sms-empty-state">No rows match your filters.</div>}
      </section>
    </main>
  )
}

export default App
