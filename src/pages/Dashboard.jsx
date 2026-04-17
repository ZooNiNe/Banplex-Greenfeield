import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck2,
  FileText,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
  Wallet,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionCard from '../components/ui/ActionCard'
import SmartList from '../components/ui/SmartList'
import useTelegram from '../hooks/useTelegram'
import useAuthStore from '../store/useAuthStore'
import useBillStore from '../store/useBillStore'
import useDashboardStore from '../store/useDashboardStore'
import useIncomeStore from '../store/useIncomeStore'
import useReportStore from '../store/useReportStore'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const listDateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const quickFilters = [
  { value: 'all', label: 'Semua' },
  { value: 'today', label: 'Hari Ini' },
  { value: 'project', label: 'Proyek' },
]

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0)
}

function formatDateLabel(value) {
  const parsedDate = new Date(String(value ?? ''))

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  return dateFormatter.format(parsedDate)
}

function formatListDate(value) {
  const parsedDate = new Date(String(value ?? ''))

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  return listDateFormatter.format(parsedDate)
}

function parseTimestamp(...values) {
  for (const value of values) {
    const parsedDate = new Date(String(value ?? ''))

    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.getTime()
    }
  }

  return 0
}

function getTodayKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function toDateKey(value) {
  const parsedDate = new Date(String(value ?? ''))

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  const year = parsedDate.getFullYear()
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const day = String(parsedDate.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getUserDisplayName(telegramUser, authUser) {
  const telegramFullName = [telegramUser?.first_name, telegramUser?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
  const resolvedValue =
    authUser?.name || telegramFullName || telegramUser?.username || null
  const normalizedValue = String(resolvedValue ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : 'Pengguna Telegram'
}

function pickText(...values) {
  for (const value of values) {
    const normalizedValue = String(value ?? '').trim()

    if (normalizedValue.length > 0) {
      return normalizedValue
    }
  }

  return ''
}

function buildTransactionItem(transaction) {
  const kind = transaction.type === 'expense' ? 'expense' : 'income'
  const isExpense = kind === 'expense'
  const timestamp = parseTimestamp(
    transaction.transaction_date,
    transaction.created_at,
    transaction.updated_at
  )
  const title = pickText(
    transaction.description,
    transaction.category,
    isExpense ? 'Pengeluaran' : 'Pemasukan'
  )
  const subtitle = pickText(
    transaction.category,
    formatListDate(transaction.transaction_date),
    formatListDate(transaction.created_at)
  )

  return {
    id: transaction.id,
    kind,
    sourceType: kind,
    title,
    subtitle,
    amount: Number(transaction.amount) || 0,
    amountClassName: isExpense ? 'text-rose-600' : 'text-emerald-600',
    badge: isExpense ? 'Pengeluaran' : 'Pemasukan',
    badgeClassName: isExpense
      ? 'border border-rose-200 bg-rose-50 text-rose-700'
      : 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: isExpense ? ArrowDownRight : ArrowUpRight,
    iconClassName: isExpense ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600',
    titleClassName: isExpense ? 'text-rose-950' : 'text-emerald-950',
    timestamp,
    dateKey: toDateKey(transaction.transaction_date || transaction.created_at),
    editType: kind,
    raw: transaction,
    projectLabel: '',
    statusLabel: '',
    payable: false,
  }
}

function buildBillItem(bill) {
  const timestamp = parseTimestamp(bill.dueDate, bill.created_at, bill.updated_at)
  const isPayable = String(bill.status ?? 'unpaid').toLowerCase() !== 'paid'
  const title = pickText(
    bill.supplierName,
    bill.description,
    bill.billType,
    'Tagihan'
  )
  const subtitle = pickText(
    bill.projectName,
    formatListDate(bill.dueDate),
    formatListDate(bill.paidAt)
  )
  const statusLabel =
    bill.status === 'partial'
      ? 'Sebagian'
      : bill.status === 'paid'
        ? 'Lunas'
        : 'Belum Bayar'

  return {
    id: bill.id,
    kind: 'bill',
    sourceType: 'bill',
    title,
    subtitle,
    amount: -Math.abs(Number(bill.remainingAmount ?? bill.amount ?? 0)),
    amountClassName: 'text-amber-700',
    badge: statusLabel,
    badgeClassName:
      bill.status === 'paid'
        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border border-amber-200 bg-amber-50 text-amber-700',
    icon: CalendarCheck2,
    iconClassName: 'bg-amber-100 text-amber-700',
    titleClassName: 'text-amber-950',
    timestamp,
    dateKey: toDateKey(bill.dueDate || bill.created_at),
    editType: 'bill',
    raw: bill,
    projectLabel: bill.projectName || '',
    statusLabel,
    payable: isPayable,
  }
}

function buildLoanItem(loan) {
  const timestamp = parseTimestamp(
    loan.transaction_date,
    loan.disbursed_date,
    loan.created_at,
    loan.updated_at
  )
  const title = pickText(
    loan.creditor_name_snapshot,
    loan.description,
    'Pinjaman'
  )
  const subtitle = pickText(
    loan.interest_type ? `Bunga ${loan.interest_type}` : '',
    formatListDate(loan.transaction_date),
    formatListDate(loan.created_at)
  )
  const statusLabel =
    String(loan.status ?? 'unpaid').toLowerCase() === 'paid'
      ? 'Lunas'
      : 'Belum Lunas'

  return {
    id: loan.id,
    kind: 'loan',
    sourceType: 'loan',
    title,
    subtitle,
    amount: Number(loan.amount ?? loan.principal_amount ?? 0),
    amountClassName: 'text-sky-600',
    badge: statusLabel,
    badgeClassName:
      String(loan.status ?? 'unpaid').toLowerCase() === 'paid'
        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border border-sky-200 bg-sky-50 text-sky-700',
    icon: Wallet,
    iconClassName: 'bg-sky-100 text-sky-600',
    titleClassName: 'text-sky-950',
    timestamp,
    dateKey: toDateKey(loan.transaction_date || loan.created_at),
    editType: 'loan',
    raw: loan,
    projectLabel: '',
    statusLabel,
    payable: false,
  }
}

function DashboardActionTile({ icon, label, onClick, colorClassName }) {
  const Icon = icon

  return (
    <button
      className="flex min-h-[84px] flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] p-2 text-center shadow-sm transition active:scale-[0.99]"
      onClick={onClick}
      type="button"
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-2xl ${colorClassName}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[10px] font-semibold leading-3 text-[var(--app-text-color)]">
        {label}
      </span>
    </button>
  )
}

function Dashboard() {
  const navigate = useNavigate()
  const { user: telegramUser } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const summary = useDashboardStore((state) => state.summary)
  const recentTransactions = useDashboardStore((state) => state.recentTransactions)
  const dashboardError = useDashboardStore((state) => state.error)
  const dashboardLoading = useDashboardStore((state) => state.isLoading)
  const isRefreshing = useDashboardStore((state) => state.isRefreshing)
  const refreshDashboard = useDashboardStore((state) => state.refreshDashboard)
  const softDeleteTransaction = useDashboardStore(
    (state) => state.softDeleteTransaction
  )
  const bills = useBillStore((state) => state.bills)
  const billsError = useBillStore((state) => state.error)
  const billsLoading = useBillStore((state) => state.isLoading)
  const fetchUnpaidBills = useBillStore((state) => state.fetchUnpaidBills)
  const softDeleteBill = useBillStore((state) => state.softDeleteBill)
  const loans = useIncomeStore((state) => state.loans)
  const loansError = useIncomeStore((state) => state.error)
  const isLoansLoading = useIncomeStore((state) => state.isLoadingLoans)
  const fetchLoans = useIncomeStore((state) => state.fetchLoans)
  const softDeleteLoan = useIncomeStore((state) => state.softDeleteLoan)
  const portfolioSummary = useReportStore((state) => state.portfolioSummary)
  const reportError = useReportStore((state) => state.error)
  const reportLoading = useReportStore((state) => state.isLoading)
  const fetchProjectSummaries = useReportStore(
    (state) => state.fetchProjectSummaries
  )
  const [activeFilter, setActiveFilter] = useState('all')

  const userDisplayName = getUserDisplayName(telegramUser, authUser)
  const todayKey = useMemo(() => getTodayKey(), [])
  const todayLabel = useMemo(() => formatDateLabel(new Date().toISOString()), [])

  const refreshAllData = useCallback(async () => {
    if (!currentTeamId) {
      return
    }

    await Promise.all([
      refreshDashboard(currentTeamId),
      fetchUnpaidBills({ teamId: currentTeamId }),
      fetchLoans({ teamId: currentTeamId }),
      fetchProjectSummaries({ force: true }),
    ])
  }, [
    currentTeamId,
    fetchLoans,
    fetchProjectSummaries,
    fetchUnpaidBills,
    refreshDashboard,
  ])

  useEffect(() => {
    void refreshAllData().catch((error) => {
      console.error('Gagal memuat dashboard terpadu:', error)
    })
  }, [refreshAllData])

  const unifiedItems = useMemo(() => {
    const transactionItems = recentTransactions.map(buildTransactionItem)
    const billItems = bills.map(buildBillItem)
    const loanItems = loans.map(buildLoanItem)

    return [...transactionItems, ...billItems, ...loanItems].sort(
      (left, right) => right.timestamp - left.timestamp
    )
  }, [bills, loans, recentTransactions])

  const filteredItems = useMemo(() => {
    if (activeFilter === 'today') {
      return unifiedItems.filter((item) => item.dateKey === todayKey)
    }

    if (activeFilter === 'project') {
      return unifiedItems.filter((item) => Boolean(item.projectLabel))
    }

    return unifiedItems
  }, [activeFilter, todayKey, unifiedItems])

  const combinedError = useMemo(() => {
    return [dashboardError, billsError, loansError, reportError]
      .filter((message, index, list) => Boolean(message) && list.indexOf(message) === index)
      .join(' | ')
  }, [billsError, dashboardError, loansError, reportError])

  const handleQuickAction = (kind) => {
    if (kind === 'salary') {
      navigate('/more')
      return
    }

    const routeMap = {
      income: '/edit/income/new',
      expense: '/edit/expense/new',
      loan: '/edit/loan/new',
    }

    navigate(routeMap[kind] ?? '/')
  }

  const handleDeleteItem = async (item) => {
    const confirmed = window.confirm(`Hapus ${item.title}? Data akan disimpan sebagai soft delete.`)

    if (!confirmed) {
      return
    }

    try {
      if (item.sourceType === 'income' || item.sourceType === 'expense') {
        await softDeleteTransaction(item.id)
      } else if (item.sourceType === 'bill') {
        await softDeleteBill(item.id)
      } else if (item.sourceType === 'loan') {
        await softDeleteLoan(item.id)
      }

      await refreshAllData()
    } catch (deleteError) {
      console.error('Gagal menghapus item:', deleteError)
    }
  }

  const quickActions = [
    {
      label: '+Pemasukan',
      icon: Plus,
      colorClassName: 'bg-emerald-100 text-emerald-700',
      onClick: () => handleQuickAction('income'),
    },
    {
      label: '+Pengeluaran',
      icon: ArrowDownRight,
      colorClassName: 'bg-rose-100 text-rose-700',
      onClick: () => handleQuickAction('expense'),
    },
    {
      label: '+Absensi',
      icon: CalendarCheck2,
      colorClassName: 'bg-amber-100 text-amber-700',
      onClick: () => navigate('/attendance/new'),
    },
    {
      label: '+Faktur',
      icon: FileText,
      colorClassName: 'bg-cyan-100 text-cyan-700',
      onClick: () => navigate('/material-invoice/new'),
    },
    {
      label: '+Pinjaman',
      icon: Wallet,
      colorClassName: 'bg-sky-100 text-sky-700',
      onClick: () => handleQuickAction('loan'),
    },
  ]

  const isLoading =
    !currentTeamId ||
    dashboardLoading ||
    billsLoading ||
    reportLoading ||
    isRefreshing ||
    isLoansLoading
  const currentProfit = portfolioSummary?.net_consolidated_profit ?? 0
  const cashBalance = summary?.endingBalance ?? 0

  return (
    <section className="space-y-3 px-2 py-2">
      <section className="app-page-surface bg-gradient-to-br from-slate-950 via-slate-800 to-cyan-900 p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-[-0.02em] text-white">
              Hai, {userDisplayName}
            </p>
            <p className="mt-1 text-[11px] text-white/70">{todayLabel}</p>
          </div>

          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={() => {
              void refreshAllData().catch((error) => {
                console.error('Gagal refresh dashboard:', error)
              })
            }}
            type="button"
            aria-label="Refresh dashboard"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-[22px] bg-white/10 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/70">
              Saldo Kas
            </p>
            <p className="mt-1 text-xl font-bold tracking-[-0.04em]">
              {formatCurrency(cashBalance)}
            </p>
          </div>

          <div className="rounded-[22px] bg-white/10 px-3 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/70">
              Laba Bersih
            </p>
            <p className="mt-1 text-sm font-semibold text-cyan-100">
              {formatCurrency(currentProfit)}
            </p>
          </div>
        </div>
      </section>

      <section className="app-page-surface p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="app-kicker">
              Aksi Cepat
            </p>
            <h2 className="app-title">
              Menu utama harian
            </h2>
          </div>

          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] text-[var(--app-text-color)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={() => {
              void refreshAllData().catch((error) => {
                console.error('Gagal refresh dashboard:', error)
              })
            }}
            type="button"
            aria-label="Refresh data"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {quickActions.map((action) => (
            <DashboardActionTile
              key={action.label}
              icon={action.icon}
              label={action.label}
              colorClassName={action.colorClassName}
              onClick={action.onClick}
            />
          ))}
        </div>
      </section>

      <section className="app-page-surface p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="app-kicker">
              Mutasi Terpadu
            </p>
            <h2 className="app-title">
              Incomes, Expenses, Bills, Loans
            </h2>
          </div>

          <p className="shrink-0 text-xs text-[var(--app-hint-color)]">
            {filteredItems.length} item
          </p>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {quickFilters.map((filter) => {
            const isActive = activeFilter === filter.value

            return (
                <button
                  key={filter.value}
                  className={`inline-flex shrink-0 items-center rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    isActive
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : 'border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] text-[var(--app-hint-color)]'
                }`}
                  onClick={() => setActiveFilter(filter.value)}
                  type="button"
              >
                {filter.label}
              </button>
            )
          })}
        </div>

        {combinedError ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
            {combinedError}
          </div>
        ) : null}

        <div className="mt-3">
          <SmartList
            data={filteredItems}
            initialCount={12}
            loadMoreStep={12}
            className="space-y-1"
            emptyState={
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 px-4 py-5 text-sm text-[var(--app-hint-color)]">
                Tidak ada mutasi pada filter ini.
              </div>
            }
            renderItem={(item) => {
              const actions = []

              if (item.payable) {
                actions.push({
                  id: `pay-${item.id}`,
                  label: 'Bayar',
                  icon: <Wallet className="h-4 w-4" />,
                  onClick: () => navigate(`/payment/${item.id}`, { state: { item: item.raw } }),
                })
              }

              actions.push({
                id: `edit-${item.id}`,
                label: 'Edit',
                icon: <Pencil className="h-4 w-4" />,
                onClick: () =>
                  navigate(`/edit/${item.editType}/${item.id}`, {
                    state: { item: item.raw },
                  }),
              })

              actions.push({
                id: `delete-${item.id}`,
                label: 'Hapus',
                icon: <Trash2 className="h-4 w-4" />,
                variant: 'danger',
                destructive: true,
                requireRole: 'Owner',
                onClick: () => handleDeleteItem(item),
              })

              const LeadingIcon = item.icon

              return (
                <ActionCard
                  amount={`${item.amount < 0 ? '-' : '+'}${formatCurrency(Math.abs(item.amount))}`}
                  amountClassName={item.amountClassName}
                  badge={item.badge}
                  badgeClassName={item.badgeClassName}
                  actions={actions}
                  className="border-slate-200/80"
                  leadingIcon={
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-2xl ${item.iconClassName}`}
                    >
                      <LeadingIcon className="h-4 w-4" />
                    </span>
                  }
                  subtitle={pickText(item.subtitle, formatListDate(item.raw.created_at))}
                  title={item.title}
                  titleClassName={item.titleClassName}
                />
              )
            }}
          />
        </div>
      </section>
    </section>
  )
}

export default Dashboard
