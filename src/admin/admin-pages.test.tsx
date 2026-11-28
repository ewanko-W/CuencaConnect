import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as adminApi from '../lib/admin/api'
import type { AdminReport, AdminReportDetail, Keyword } from '../lib/admin/types'
import { authAs, renderWithAuth } from '../test/renderWithAuth'

vi.mock('../components/admin/ReportsMap', () => ({
  ReportsMap: ({ reports }: { reports: AdminReport[] }) => <div role="region" aria-label="Map of reports">{reports.length} pins</div>,
}))
vi.mock('../components/map/BaseMap', () => ({
  BaseMap: ({ label }: { label: string }) => <div role="region" aria-label={label} />,
}))
vi.mock('../lib/auth/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/auth/api')>()
  return {
    ...actual,
    fetchBarangays: vi.fn(async () => [
      { id: 6, name: 'Dita' },
      { id: 14, name: 'Barangay 1 (Poblacion)' },
    ]),
  }
})
vi.mock('../lib/admin/api', () => ({
  fetchAdminReports: vi.fn(),
  fetchOpenCriticalReports: vi.fn(),
  subscribeToReports: vi.fn(() => () => {}),
  fetchAdminReport: vi.fn(),
  fetchActiveOffices: vi.fn(),
  routeReport: vi.fn(async () => {}),
  setReportStatus: vi.fn(async () => {}),
  fetchAllAlerts: vi.fn(async () => []),
  broadcastAlert: vi.fn(async () => {}),
  setAlertActive: vi.fn(async () => {}),
  fetchKeywords: vi.fn(),
  addKeyword: vi.fn(async () => {}),
  updateKeyword: vi.fn(async () => {}),
  deleteKeyword: vi.fn(async () => {}),
  previewTriage: vi.fn(),
  fetchAuditEntries: vi.fn(async () => []),
  fetchThresholds: vi.fn(async () => ({ min_confirms: 3, min_disputes: 3, dominance_ratio: 2, updated_at: 't1' })),
  updateThresholds: vi.fn(async () => {}),
}))

const BFP = { id: 2, name: 'Bureau of Fire Protection - Cuenca', code: 'BFP' }
const MEO = { id: 5, name: 'Municipal Engineering Office', code: 'MEO' }

function report(overrides: Partial<AdminReport> = {}): AdminReport {
  return {
    id: 'r1',
    category: 'fire',
    description: 'May sunog sa likod ng palengke.',
    status: 'submitted',
    severity: 'critical',
    is_critical: true,
    priority_score: 400,
    created_at: new Date().toISOString(),
    lat: 13.9079,
    lng: 121.0521,
    confirm_count: 0,
    dispute_count: 3,
    community_status: 'disputed',
    matched_keywords: ['sunog'],
    barangay: { id: 6, name: 'Dita' },
    suggested_office: BFP,
    assigned_office: null,
    ...overrides,
  }
}

function detail(overrides: Partial<AdminReportDetail> = {}): AdminReportDetail {
  return {
    ...report(),
    location_source: 'gps',
    gps_accuracy_m: 9,
    resolved_at: null,
    reporter: { display_name: 'Maria Santos (Demo)' },
    events: [{ status: 'submitted', note: null, created_at: '2026-11-27T01:00:00Z' }],
    routing: [],
    photoUrls: [],
    ...overrides,
  }
}

const admin = () => authAs('admin')

beforeEach(() => {
  vi.mocked(adminApi.fetchActiveOffices).mockResolvedValue([
    { ...BFP, handles_categories: ['fire'] },
    { ...MEO, handles_categories: ['road'] },
  ])
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => vi.clearAllMocks())

describe('admin area access', () => {
  it('sends a resident who opens an admin page back to /app', async () => {
    const { router } = renderWithAuth('/admin/keywords', authAs('resident'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'))
  })
})

describe('Command Center', () => {
  it('always shows open critical reports, even when the filters hide them', async () => {
    vi.mocked(adminApi.fetchAdminReports).mockResolvedValue([])
    vi.mocked(adminApi.fetchOpenCriticalReports).mockResolvedValue([report()])
    renderWithAuth('/admin/command?category=road', admin())

    const panel = await screen.findByRole('region', { name: /critical, open \(1\)/i })
    expect(within(panel).getByText('NOT ROUTED')).toBeInTheDocument()
    // Disputed by residents, still listed as critical.
    expect(within(panel).getByText('Disputed')).toBeInTheDocument()
    expect(await screen.findByText('No reports match these filters.')).toBeInTheDocument()
  })

  it('lists reports by priority and applies filters from the filter bar', async () => {
    vi.mocked(adminApi.fetchAdminReports).mockResolvedValue([
      report(),
      report({ id: 'r2', category: 'road', severity: 'low', is_critical: false, suggested_office: MEO, description: 'Pothole' }),
    ])
    vi.mocked(adminApi.fetchOpenCriticalReports).mockResolvedValue([])
    const user = userEvent.setup()
    const { router } = renderWithAuth('/admin/command', admin())

    const table = await screen.findByRole('table', { name: 'Reports by priority' })
    await within(table).findByText('Suggested: MEO')
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(screen.getByRole('region', { name: 'Map of reports' })).toHaveTextContent('2 pins')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'critical')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Barangay' }), '6')

    await waitFor(() =>
      expect(adminApi.fetchAdminReports).toHaveBeenLastCalledWith({
        category: '',
        status: 'active',
        severity: 'critical',
        barangayId: 6,
      }),
    )
    expect(router.state.location.search).toBe('?priority=critical&barangay=6')
  })
})

describe('Admin report detail', () => {
  it('routes to the suggested office by default', async () => {
    vi.mocked(adminApi.fetchAdminReport).mockResolvedValue(detail())
    const user = userEvent.setup()
    renderWithAuth('/admin/command/r1', admin())

    const routing = await screen.findByRole('form', { name: 'Route to office' })
    await waitFor(() => expect(within(routing).getByRole('combobox', { name: 'Office' })).toHaveValue('2'))
    await user.type(within(routing).getByRole('textbox'), 'Nearest station')
    await user.click(within(routing).getByRole('button', { name: 'Route report' }))

    expect(adminApi.routeReport).toHaveBeenCalledWith('r1', 2, 'Nearest station')
    expect(await within(routing).findByRole('status')).toHaveTextContent('Sent to Bureau of Fire Protection - Cuenca')
  })

  it('does not offer Received/In progress/Resolved before routing', async () => {
    vi.mocked(adminApi.fetchAdminReport).mockResolvedValue(detail())
    renderWithAuth('/admin/command/r1', admin())
    const status = await screen.findByRole('region', { name: 'Update status' })
    expect(within(status).queryByRole('button', { name: 'Received' })).not.toBeInTheDocument()
    expect(within(status).getByText(/route the report to an office/i)).toBeInTheDocument()
  })

  it('marks a routed report as received', async () => {
    vi.mocked(adminApi.fetchAdminReport).mockResolvedValue(detail({ status: 'routed', assigned_office: BFP }))
    const user = userEvent.setup()
    renderWithAuth('/admin/command/r1', admin())

    const status = await screen.findByRole('region', { name: 'Update status' })
    await user.click(within(status).getByRole('button', { name: 'Received' }))
    await user.click(within(status).getByRole('button', { name: 'Confirm: Received' }))
    expect(adminApi.setReportStatus).toHaveBeenCalledWith('r1', 'acknowledged', '')
  })

  it('requires a note before rejecting', async () => {
    vi.mocked(adminApi.fetchAdminReport).mockResolvedValue(detail({ status: 'routed', assigned_office: BFP }))
    const user = userEvent.setup()
    renderWithAuth('/admin/command/r1', admin())

    const status = await screen.findByRole('region', { name: 'Update status' })
    await user.click(within(status).getByRole('button', { name: 'Reject' }))
    const confirm = within(status).getByRole('button', { name: 'Confirm: Reject' })
    expect(confirm).toBeDisabled()
    await user.type(within(status).getByRole('textbox', { name: /required/i }), 'Duplicate of another fire report')
    await user.click(confirm)
    expect(adminApi.setReportStatus).toHaveBeenCalledWith('r1', 'rejected', 'Duplicate of another fire report')
  })

  it('shows the database error when an action is refused', async () => {
    vi.mocked(adminApi.fetchAdminReport).mockResolvedValue(detail())
    vi.mocked(adminApi.routeReport).mockRejectedValueOnce(new Error('Choose an active office'))
    const user = userEvent.setup()
    renderWithAuth('/admin/command/r1', admin())
    const routing = await screen.findByRole('form', { name: 'Route to office' })
    await waitFor(() => expect(within(routing).getByRole('combobox', { name: 'Office' })).toHaveValue('2'))
    await user.click(within(routing).getByRole('button', { name: 'Route report' }))
    expect(await within(routing).findByRole('alert')).toHaveTextContent('Choose an active office')
  })
})

describe('Alert broadcasting', () => {
  it('requires a barangay for targeted alerts and then broadcasts', async () => {
    const user = userEvent.setup()
    renderWithAuth('/admin/alerts', admin())
    const form = await screen.findByRole('form', { name: 'New alert' })

    await user.click(within(form).getByRole('radio', { name: 'Emergency' }))
    await user.type(within(form).getByRole('textbox', { name: 'Title' }), 'Evacuate the creek area')
    await user.type(within(form).getByRole('textbox', { name: 'Message' }), 'Proceed to the barangay hall now.')
    await user.click(within(form).getByRole('radio', { name: 'Selected barangays' }))
    await user.click(within(form).getByRole('button', { name: 'Broadcast alert' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('Select at least one barangay')
    expect(adminApi.broadcastAlert).not.toHaveBeenCalled()

    await user.click(await within(form).findByRole('checkbox', { name: 'Dita' }))
    await user.click(within(form).getByRole('button', { name: 'Broadcast alert' }))
    expect(adminApi.broadcastAlert).toHaveBeenCalledWith({
      title: 'Evacuate the creek area',
      body: 'Proceed to the barangay hall now.',
      level: 'emergency',
      scope: 'barangay',
      targetBarangayIds: [6],
      expiresInHours: 24,
    })
    expect(await within(form).findByRole('status')).toHaveTextContent('Alert broadcast')
  })
})

describe('Keyword lists', () => {
  const keywords: Keyword[] = [
    { id: 1, term: 'sunog', lang: 'fil', category: 'fire', severity: 'critical', is_active: true, updated_at: '' },
    { id: 2, term: 'baha', lang: 'fil', category: 'flood', severity: 'medium', is_active: true, updated_at: '' },
    { id: 3, term: 'fire', lang: 'en', category: 'fire', severity: 'critical', is_active: true, updated_at: '' },
  ]

  it('shows the Filipino and English lists and edits them', async () => {
    vi.mocked(adminApi.fetchKeywords).mockResolvedValue(keywords)
    const user = userEvent.setup()
    renderWithAuth('/admin/keywords', admin())

    const filipino = await screen.findByRole('table', { name: 'Filipino keywords' })
    await within(filipino).findByRole('rowheader', { name: 'sunog' })
    expect(within(filipino).queryByRole('rowheader', { name: 'fire' })).not.toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: /new filipino keyword/i }), 'Gumuho')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'critical')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(adminApi.addKeyword).toHaveBeenCalledWith({ term: 'gumuho', lang: 'fil', category: null, severity: 'critical' })

    await user.click(screen.getByRole('checkbox', { name: 'baha is active' }))
    expect(adminApi.updateKeyword).toHaveBeenCalledWith(2, { is_active: false })

    await user.click(screen.getByRole('tab', { name: /english/i }))
    expect(await screen.findByRole('table', { name: 'English keywords' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'fire' })).toBeInTheDocument()
  })

  it('previews triage for sample text', async () => {
    vi.mocked(adminApi.fetchKeywords).mockResolvedValue(keywords)
    vi.mocked(adminApi.previewTriage).mockResolvedValue({
      severity: 'critical',
      is_critical: true,
      matched_keywords: ['sunog'],
      suggested_office_name: 'Bureau of Fire Protection - Cuenca',
    })
    const user = userEvent.setup()
    renderWithAuth('/admin/keywords', admin())
    await user.type(await screen.findByRole('textbox', { name: 'Sample report text' }), 'May sunog dito')
    await user.click(screen.getByRole('button', { name: 'Preview triage' }))
    const result = await screen.findByLabelText('Triage result')
    expect(result).toHaveTextContent('Critical')
    expect(result).toHaveTextContent('Bureau of Fire Protection - Cuenca')
    expect(adminApi.previewTriage).toHaveBeenCalledWith('May sunog dito', 'other')
  })
})

describe('Community verification thresholds', () => {
  it('shows the current thresholds and saves new ones', async () => {
    vi.mocked(adminApi.fetchKeywords).mockResolvedValue([])
    const user = userEvent.setup()
    renderWithAuth('/admin/keywords', admin())

    const form = await screen.findByRole('form', { name: 'Community verification' })
    const disputes = within(form).getByRole('spinbutton', { name: 'Disputes needed' })
    expect(disputes).toHaveValue(3)
    expect(form).toHaveTextContent(/critical reports are never hidden/i)

    await user.clear(disputes)
    await user.type(disputes, '5')
    await user.click(within(form).getByRole('button', { name: 'Save thresholds' }))

    expect(adminApi.updateThresholds).toHaveBeenCalledWith({ min_confirms: 3, min_disputes: 5, dominance_ratio: 2 })
    expect(await within(form).findByRole('status')).toHaveTextContent(/re-evaluated/i)
  })
})
