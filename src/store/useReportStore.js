import { create } from 'zustand'
import { supabase } from '../lib/supabase'

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function normalizeProjectType(value) {
  return String(value ?? '').trim().toLowerCase() === 'internal' ? 'Internal' : 'Utama'
}

function toNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function toError(error, fallbackMessage) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : fallbackMessage

  return error instanceof Error ? error : new Error(message)
}

function normalizeSummaryRow(row) {
  return {
    ...row,
    project_type: normalizeProjectType(row?.project_type),
    total_income: toNumber(row?.total_income),
    material_expense: toNumber(row?.material_expense),
    operating_expense: toNumber(row?.operating_expense),
    salary_expense: toNumber(row?.salary_expense),
    gross_profit: toNumber(row?.gross_profit),
    net_profit: toNumber(row?.net_profit),
    net_profit_project: toNumber(row?.net_profit_project ?? row?.net_profit),
    company_overhead: toNumber(row?.company_overhead),
    project_status: normalizeText(row?.project_status, 'inactive'),
  }
}

function normalizeIncomeRow(row) {
  return {
    ...row,
    amount: toNumber(row?.amount),
  }
}

function normalizeExpenseRow(row) {
  return {
    ...row,
    total_amount: toNumber(row?.total_amount),
  }
}

function normalizeSalaryRow(row) {
  return {
    ...row,
    total_pay: toNumber(row?.total_pay),
  }
}

function combineSummaryRows(rows = []) {
  if (rows.length === 0) {
    return null
  }

  const firstRow = rows[0]

  return normalizeSummaryRow({
    ...firstRow,
    total_income: rows.reduce((sum, row) => sum + toNumber(row.total_income), 0),
    material_expense: rows.reduce((sum, row) => sum + toNumber(row.material_expense), 0),
    operating_expense: rows.reduce((sum, row) => sum + toNumber(row.operating_expense), 0),
    salary_expense: rows.reduce((sum, row) => sum + toNumber(row.salary_expense), 0),
    gross_profit: rows.reduce((sum, row) => sum + toNumber(row.gross_profit), 0),
    net_profit: rows.reduce((sum, row) => sum + toNumber(row.net_profit), 0),
    net_profit_project: rows.reduce((sum, row) => sum + toNumber(row.net_profit_project ?? row.net_profit), 0),
    company_overhead: rows.reduce((sum, row) => sum + toNumber(row.company_overhead), 0),
  })
}

function createPortfolioSummary(rows = []) {
  const totalProjectProfit = rows.reduce(
    (sum, row) => sum + toNumber(row.net_profit_project ?? row.net_profit),
    0
  )
  const totalCompanyOverhead = rows.reduce((sum, row) => sum + toNumber(row.company_overhead), 0)

  return {
    total_project_profit: totalProjectProfit,
    total_company_overhead: totalCompanyOverhead,
    net_consolidated_profit: totalProjectProfit - totalCompanyOverhead,
  }
}

async function loadProjectSummaries() {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const { data, error } = await supabase
    .from('vw_project_financial_summary')
    .select(
      'project_id, team_id, project_name, project_type, project_status, total_income, material_expense, operating_expense, salary_expense, gross_profit, net_profit, net_profit_project, company_overhead'
    )
    .order('project_name', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map(normalizeSummaryRow)
}

async function loadProjectDetail(projectId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedProjectId = normalizeText(projectId)

  if (!normalizedProjectId) {
    throw new Error('Project ID wajib diisi.')
  }

  const [
    summariesResult,
    incomesResult,
    expensesResult,
    salariesResult,
  ] = await Promise.all([
    supabase
      .from('vw_project_financial_summary')
      .select(
        'project_id, team_id, project_name, project_type, project_status, total_income, material_expense, operating_expense, salary_expense, gross_profit, net_profit, net_profit_project, company_overhead'
      )
      .eq('project_id', normalizedProjectId),
    supabase
      .from('project_incomes')
      .select('id, project_id, team_id, transaction_date, amount, description, created_at')
      .eq('project_id', normalizedProjectId)
      .is('deleted_at', null)
      .order('transaction_date', { ascending: false }),
    supabase
      .from('expenses')
      .select(
        'id, project_id, team_id, expense_date, expense_type, status, total_amount, description, created_at'
      )
      .eq('project_id', normalizedProjectId)
      .is('deleted_at', null)
      .order('expense_date', { ascending: false }),
    supabase
      .from('attendance_records')
      .select(
        'id, project_id, team_id, worker_id, attendance_date, attendance_status, total_pay, billing_status, salary_bill_id, notes, created_at, workers:worker_id ( id, name ), bills:salary_bill_id ( id, bill_type, amount, due_date, status, description )'
      )
      .eq('project_id', normalizedProjectId)
      .is('deleted_at', null)
      .eq('billing_status', 'billed')
      .order('attendance_date', { ascending: false }),
  ])

  const [summaries, incomes, expenses, salaries] = [
    summariesResult,
    incomesResult,
    expensesResult,
    salariesResult,
  ].map((result) => {
    if (result.error) {
      throw result.error
    }

    return result.data ?? []
  })

  return {
    summary: combineSummaryRows(summaries),
    incomes: incomes.map(normalizeIncomeRow),
    expenses: expenses.map(normalizeExpenseRow),
    salaries: salaries.map(normalizeSalaryRow),
  }
}

const useReportStore = create((set, get) => ({
  projectSummaries: [],
  portfolioSummary: createPortfolioSummary(),
  selectedProjectDetail: null,
  isLoading: false,
  isDetailLoading: false,
  error: null,
  detailError: null,
  lastUpdatedAt: null,
  clearError: () => set({ error: null, detailError: null }),
  fetchProjectSummaries: async ({ force = false } = {}) => {
    const { projectSummaries, isLoading } = get()

    if (!force && !isLoading && projectSummaries.length > 0) {
      return projectSummaries
    }

    set({ isLoading: true, error: null })

    try {
      const nextSummaries = await loadProjectSummaries()

      set({
        projectSummaries: nextSummaries,
        portfolioSummary: createPortfolioSummary(nextSummaries),
        isLoading: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      })

      return nextSummaries
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat laporan proyek.')

      set({
        projectSummaries: [],
        portfolioSummary: createPortfolioSummary(),
        isLoading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  fetchProjectDetail: async (projectId) => {
    set({ isDetailLoading: true, detailError: null })

    try {
      const detail = await loadProjectDetail(projectId)

      set({
        selectedProjectDetail: detail,
        isDetailLoading: false,
        detailError: null,
      })

      return detail
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat detail proyek.')

      set({
        selectedProjectDetail: null,
        isDetailLoading: false,
        detailError: normalizedError.message,
      })

      throw normalizedError
    }
  },
}))

export default useReportStore
export { useReportStore }
