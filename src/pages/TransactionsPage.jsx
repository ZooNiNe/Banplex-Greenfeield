import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Filter, RefreshCcw } from 'lucide-react'
import SmartList from '../components/ui/SmartList'
import useTelegram from '../hooks/useTelegram'
import useAuthStore from '../store/useAuthStore'
import useDashboardStore from '../store/useDashboardStore'

const filters = [
  { value: 'all', label: 'Semua' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'expense', label: 'Pengeluaran' },
]

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0)
}

function formatDate(value) {
  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return 'waktu belum tersedia'
  }

  return dateFormatter.format(parsedDate)
}

function TransactionsPage() {
  const { user: telegramUser } = useTelegram()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const recentTransactions = useDashboardStore((state) => state.recentTransactions)
  const error = useDashboardStore((state) => state.error)
  const lastUpdatedAt = useDashboardStore((state) => state.lastUpdatedAt)
  const refreshDashboard = useDashboardStore((state) => state.refreshDashboard)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!currentTeamId) {
      return
    }

    void refreshDashboard(currentTeamId, { silent: true }).catch((dashboardError) => {
      console.error('Gagal memuat transaksi:', dashboardError)
    })
  }, [currentTeamId, refreshDashboard])

  const filteredTransactions = useMemo(() => {
    if (filter === 'income') {
      return recentTransactions.filter((transaction) => transaction.type !== 'expense')
    }

    if (filter === 'expense') {
      return recentTransactions.filter((transaction) => transaction.type === 'expense')
    }

    return recentTransactions
  }, [filter, recentTransactions])

  return (
    <section className="space-y-4 px-2 py-2">
      <div className="app-page-surface px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="app-kicker">
              Transaksi
            </p>
            <h1 className="app-title text-[1.2rem]">
              Daftar Mutasi Terpadu
            </h1>
            <p className="app-copy">
              Semua arus kas dikumpulkan dalam satu daftar untuk monitoring cepat.
            </p>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] text-[var(--app-text-color)]"
            onClick={() => {
              if (!currentTeamId) {
                return
              }

              void refreshDashboard(currentTeamId, { silent: true }).catch((dashboardError) => {
                console.error('Gagal refresh transaksi:', dashboardError)
              })
            }}
            type="button"
            aria-label="Refresh transaksi"
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            <Filter className="h-3 w-3" />
            {telegramUser?.first_name || 'Workspace'}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            Team {currentTeamId || '-'}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            Sinkron {lastUpdatedAt ? formatDate(lastUpdatedAt) : 'belum ada'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.value}
            className={`rounded-full px-3 py-2 text-xs font-medium transition ${
              filter === item.value
                ? 'bg-slate-950 text-white'
                : 'border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] text-[var(--app-hint-color)]'
            }`}
            onClick={() => setFilter(item.value)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <SmartList
        data={filteredTransactions}
        as="div"
        className="space-y-2"
        renderItem={(transaction) => {
          const isExpense = transaction.type === 'expense'
          const Icon = isExpense ? ArrowDownRight : ArrowUpRight
          const amountClassName = isExpense ? 'text-rose-600' : 'text-emerald-600'
          const badgeClassName = isExpense
            ? 'border border-rose-200 bg-rose-50 text-rose-700'
            : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
          const signedAmount = `${isExpense ? '-' : '+'}${formatCurrency(Math.abs(transaction.amount))}`

          return (
            <article className="app-section-surface px-4 py-3">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                    isExpense ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                        {transaction.description || transaction.category || 'Transaksi tanpa deskripsi'}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[var(--app-hint-color)]">
                        {transaction.category || 'Kategori belum diisi'}
                      </p>
                    </div>

                    <p className={`shrink-0 text-sm font-semibold ${amountClassName}`}>
                      {signedAmount}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeClassName}`}>
                      {isExpense ? 'Pengeluaran' : 'Pemasukan'}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                      {formatDate(transaction.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          )
        }}
        emptyState={
          <div className="app-section-surface border-dashed px-4 py-5 text-sm text-[var(--app-hint-color)]">
            Belum ada mutasi yang tersimpan untuk workspace ini.
          </div>
        }
      />
    </section>
  )
}

export default TransactionsPage
