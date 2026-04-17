import { useEffect, useMemo, useState } from 'react'
import { BarChart3, FileText, RefreshCcw } from 'lucide-react'
import useReportStore from '../store/useReportStore'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatCurrency(value) {
  const amount = Number(value)

  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function formatDate(value) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return '-'
  }

  const parsedDate = new Date(normalizedValue)

  if (!Number.isNaN(parsedDate.getTime())) {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(parsedDate)
  }

  return normalizedValue
}

function getProfitStyles(value) {
  if (value >= 0) {
    return {
      cardClassName: 'border-emerald-200 bg-emerald-50/85 text-emerald-950',
      amountClassName: 'text-emerald-700',
      badgeClassName: 'border-emerald-200 bg-emerald-100 text-emerald-700',
      label: 'Untung',
    }
  }

  return {
    cardClassName: 'border-rose-200 bg-rose-50/85 text-rose-950',
    amountClassName: 'text-rose-700',
    badgeClassName: 'border-rose-200 bg-rose-100 text-rose-700',
    label: 'Rugi',
  }
}

function buildCompactSummary(projectSummaries) {
  return projectSummaries.reduce(
    (accumulator, summary) => {
      accumulator.totalIncome += Number(summary.total_income ?? 0)
      accumulator.materialExpense += Number(summary.material_expense ?? 0)
      accumulator.operatingExpense += Number(summary.operating_expense ?? 0)
      accumulator.salaryExpense += Number(summary.salary_expense ?? 0)
      accumulator.grossProfit += Number(summary.gross_profit ?? 0)
      accumulator.netProfit += Number(summary.net_profit ?? 0)

      return accumulator
    },
    {
      totalIncome: 0,
      materialExpense: 0,
      operatingExpense: 0,
      salaryExpense: 0,
      grossProfit: 0,
      netProfit: 0,
    }
  )
}

function ProjectReport() {
  const [expandedProjectId, setExpandedProjectId] = useState(null)
  const projectSummaries = useReportStore((state) => state.projectSummaries)
  const selectedProjectDetail = useReportStore((state) => state.selectedProjectDetail)
  const isLoading = useReportStore((state) => state.isLoading)
  const isDetailLoading = useReportStore((state) => state.isDetailLoading)
  const error = useReportStore((state) => state.error)
  const detailError = useReportStore((state) => state.detailError)
  const lastUpdatedAt = useReportStore((state) => state.lastUpdatedAt)
  const fetchProjectSummaries = useReportStore((state) => state.fetchProjectSummaries)
  const fetchProjectDetail = useReportStore((state) => state.fetchProjectDetail)

  const compactSummary = useMemo(
    () => buildCompactSummary(projectSummaries),
    [projectSummaries]
  )

  useEffect(() => {
    fetchProjectSummaries({ force: true }).catch((fetchError) => {
      console.error('Gagal memuat laporan proyek:', fetchError)
    })
  }, [fetchProjectSummaries])

  const handleToggleDetail = async (projectId) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null)
      return
    }

    setExpandedProjectId(projectId)
    await fetchProjectDetail(projectId)
  }

  return (
    <section className="space-y-6 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--app-accent-color)]">
              Laporan Proyek
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
              Project Financial Summary
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-[var(--app-hint-color)]">
              Lihat kesehatan keuangan tiap proyek dari pemasukan, biaya material,
              biaya gaji, biaya operasional, sampai laba atau rugi bersih.
            </p>
          </div>

          <button
            className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-[var(--app-text-color)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={() => {
              void fetchProjectSummaries({ force: true }).catch((fetchError) => {
                console.error('Gagal memuat ulang laporan proyek:', fetchError)
              })
            }}
            type="button"
          >
            <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-[24px] border border-slate-200 bg-slate-950 px-5 py-5 text-white shadow-lg shadow-slate-950/15">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
              Total Pemasukan
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
              {formatCurrency(compactSummary.totalIncome)}
            </p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white/90 px-5 py-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Total Biaya
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              {formatCurrency(
                compactSummary.materialExpense +
                  compactSummary.operatingExpense +
                  compactSummary.salaryExpense
              )}
            </p>
          </article>
          <article className="rounded-[24px] border border-sky-200 bg-sky-50/80 px-5 py-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-700">
              Laba Bersih
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-sky-800">
              {formatCurrency(compactSummary.netProfit)}
            </p>
          </article>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          {error}
        </div>
      ) : null}

      {projectSummaries.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {projectSummaries.map((summary) => {
            const profitStyles = getProfitStyles(summary.net_profit)
            const isActive = expandedProjectId === summary.project_id
            const summaryProjectName = summary.project_name ?? 'Proyek tanpa nama'

            return (
              <article
                key={`${summary.project_id}-${summary.team_id ?? 'no-team'}`}
                className={`overflow-hidden rounded-[28px] border px-5 py-5 shadow-sm transition ${
                  profitStyles.cardClassName
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-current/70" />
                      <p className="text-lg font-semibold tracking-[-0.02em]">
                        {summaryProjectName}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                      <span className={`rounded-full border px-3 py-1.5 ${profitStyles.badgeClassName}`}>
                        {summary.project_status}
                      </span>
                      {summary.team_id ? (
                        <span className="rounded-full border border-slate-200 bg-white/75 px-3 py-1.5 text-slate-600">
                          Team {summary.team_id}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-current/55">
                      Laba / Rugi Bersih
                    </p>
                    <p className={`mt-2 text-2xl font-semibold tracking-[-0.03em] ${profitStyles.amountClassName}`}>
                      {formatCurrency(summary.net_profit)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/60 bg-white/75 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Pemasukan
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-950">
                      {formatCurrency(summary.total_income)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/60 bg-white/75 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Biaya Material
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-950">
                      {formatCurrency(summary.material_expense)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/60 bg-white/75 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Biaya Gaji
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-950">
                      {formatCurrency(summary.salary_expense)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/60 bg-white/75 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Biaya Ops
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-950">
                      {formatCurrency(summary.operating_expense)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div className="rounded-full border border-current/15 bg-white/80 px-3 py-1.5 text-xs font-medium text-current/70">
                    Gross Profit {formatCurrency(summary.gross_profit)}
                  </div>
                  <div className="rounded-full border border-current/15 bg-white/80 px-3 py-1.5 text-xs font-medium text-current/70">
                    Net Profit {summary.net_profit >= 0 ? 'positif' : 'negatif'}
                  </div>
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-current/20 bg-white/80 px-4 py-2 text-sm font-semibold text-current transition hover:bg-white"
                    onClick={() => void handleToggleDetail(summary.project_id)}
                    type="button"
                  >
                    <FileText className="h-4 w-4" />
                    {isActive ? 'Tutup Breakdown' : 'Lihat Breakdown'}
                  </button>
                </div>

                {isActive ? (
                  <div className="mt-5 space-y-4 rounded-[24px] border border-current/10 bg-white/80 p-4">
                    {isDetailLoading ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                        Memuat breakdown proyek...
                      </div>
                    ) : detailError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                        {detailError}
                      </div>
                    ) : selectedProjectDetail?.summary ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                              Pemasukan Total
                            </p>
                            <p className="mt-2 font-semibold text-slate-950">
                              {formatCurrency(selectedProjectDetail.summary.total_income)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                              Gross Profit
                            </p>
                            <p className="mt-2 font-semibold text-slate-950">
                              {formatCurrency(selectedProjectDetail.summary.gross_profit)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                              Net Profit
                            </p>
                            <p className="mt-2 font-semibold text-slate-950">
                              {formatCurrency(selectedProjectDetail.summary.net_profit)}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-3">
                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-slate-900">
                              Pemasukan
                            </p>
                            <div className="space-y-2">
                              {selectedProjectDetail.incomes.length > 0 ? (
                                selectedProjectDetail.incomes.map((income) => (
                                  <div
                                    key={income.id}
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                                  >
                                    <p className="font-medium text-slate-900">
                                      {formatDate(income.transaction_date)}
                                    </p>
                                    <p className="text-slate-500">
                                      {income.description ?? '-'}
                                    </p>
                                    <p className="mt-1 font-semibold text-emerald-700">
                                      {formatCurrency(income.amount)}
                                    </p>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                                  Tidak ada pemasukan proyek.
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-slate-900">
                              Biaya Material
                            </p>
                            <div className="space-y-2">
                              {selectedProjectDetail.expenses.length > 0 ? (
                                selectedProjectDetail.expenses.map((expense) => (
                                  <div
                                    key={expense.id}
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                                  >
                                    <p className="font-medium text-slate-900">
                                      {formatDate(expense.expense_date)}
                                    </p>
                                    <p className="text-slate-500">
                                      {expense.expense_type ?? '-'} - {expense.description ?? '-'}
                                    </p>
                                    <p className="mt-1 font-semibold text-rose-700">
                                      {formatCurrency(expense.total_amount)}
                                    </p>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                                  Tidak ada pengeluaran proyek.
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-slate-900">
                              Biaya Gaji
                            </p>
                            <div className="space-y-2">
                              {selectedProjectDetail.salaries.length > 0 ? (
                                selectedProjectDetail.salaries.map((salary) => (
                                  <div
                                    key={salary.id}
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                                  >
                                    <p className="font-medium text-slate-900">
                                      {formatDate(salary.attendance_date)}
                                    </p>
                                    <p className="text-slate-500">
                                      {salary.workers?.name ?? 'Pekerja'} - {salary.attendance_status ?? '-'}
                                    </p>
                                    <p className="mt-1 font-semibold text-amber-700">
                                      {formatCurrency(salary.total_pay)}
                                    </p>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                                  Tidak ada biaya gaji yang sudah dibundel.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white/80 px-4 py-5 text-sm text-[var(--app-hint-color)]">
          Memuat laporan proyek...
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm leading-6 text-[var(--app-hint-color)]">
          Belum ada laporan proyek yang bisa ditampilkan. Tambahkan pemasukan,
          pengeluaran, atau absensi gaji untuk memunculkan ringkasan.
        </div>
      )}
    </section>
  )
}

export default ProjectReport
