import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { resolveTeamId } from '../lib/auth-context'

function createEmptySummary() {
  return {
    totalIncome: 0,
    totalExpense: 0,
    endingBalance: 0,
  }
}

function normalizeTeamId(teamId) {
  const normalizedValue = String(teamId ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : null
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

function mapSummaryRow(data) {
  return {
    totalIncome: toNumber(data?.total_income),
    totalExpense: toNumber(data?.total_expense),
    endingBalance: toNumber(data?.ending_balance),
  }
}

function mapTransactionRow(transaction) {
  return {
    ...transaction,
    amount: toNumber(transaction?.amount),
  }
}

async function loadSummary(telegramUserId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const teamId = resolveTeamId(telegramUserId)

  if (!teamId) {
    return createEmptySummary()
  }

  const { data, error } = await supabase
    .from('vw_transaction_summary')
    .select('team_id, total_income, total_expense, ending_balance')
    .eq('team_id', teamId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? mapSummaryRow(data) : createEmptySummary()
}

async function loadRecentTransactions(telegramUserId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const teamId = resolveTeamId(telegramUserId)

  if (!teamId) {
    return []
  }

  const { data, error } = await supabase
    .from('transactions')
    .select(
      'id, telegram_user_id, team_id, type, category, amount, transaction_date, description, notes, created_at'
    )
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    throw error
  }

  return (data ?? []).map(mapTransactionRow)
}

async function softDeleteTransaction(transactionId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedTransactionId = String(transactionId ?? '').trim()

  if (!normalizedTransactionId) {
    throw new Error('Transaction ID tidak valid.')
  }

  const { error } = await supabase
    .from('transactions')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', normalizedTransactionId)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return true
}

const useDashboardStore = create((set) => ({
  summary: createEmptySummary(),
  recentTransactions: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
  lastUpdatedAt: null,
  clearError: () => set({ error: null }),
  softDeleteTransaction: async (transactionId) => {
    try {
      await softDeleteTransaction(transactionId)
      return true
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menghapus transaksi.')

      set({
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  fetchSummary: async (teamId) => {
    const normalizedTeamId = normalizeTeamId(resolveTeamId(teamId))
    const summary = await loadSummary(normalizedTeamId)

    set({
      summary,
      error: null,
    })

    return summary
  },
  fetchRecentTransactions: async (teamId) => {
    const normalizedTeamId = normalizeTeamId(resolveTeamId(teamId))
    const recentTransactions = await loadRecentTransactions(normalizedTeamId)

    set({
      recentTransactions,
      error: null,
    })

    return recentTransactions
  },
  refreshDashboard: async (teamId, { silent = false } = {}) => {
    const normalizedTeamId = normalizeTeamId(resolveTeamId(teamId))

    if (!normalizedTeamId) {
      const emptySummary = createEmptySummary()

      set({
        summary: emptySummary,
        recentTransactions: [],
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdatedAt: null,
      })

      return {
        summary: emptySummary,
        recentTransactions: [],
      }
    }

    set({
      isLoading: silent ? false : true,
      isRefreshing: silent,
      error: null,
    })

    try {
      const [summary, recentTransactions] = await Promise.all([
        loadSummary(normalizedTeamId),
        loadRecentTransactions(normalizedTeamId),
      ])

      set({
        summary,
        recentTransactions,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      })

      return {
        summary,
        recentTransactions,
      }
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat dashboard.')

      set({
        isLoading: false,
        isRefreshing: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
}))

export default useDashboardStore
export { useDashboardStore }
