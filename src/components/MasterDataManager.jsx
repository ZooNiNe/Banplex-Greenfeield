import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import ProtectedRoute from './ProtectedRoute'
import GenericMasterForm from './master/GenericMasterForm'
import { masterTabs } from './master/masterTabs'
import useAuthStore from '../store/useAuthStore'
import useMasterStore from '../store/useMasterStore'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0)
}

function MasterDataManager() {
  const navigate = useNavigate()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const projects = useMasterStore((state) => state.projects)
  const categories = useMasterStore((state) => state.categories)
  const suppliers = useMasterStore((state) => state.suppliers)
  const fundingCreditors = useMasterStore((state) => state.fundingCreditors)
  const professions = useMasterStore((state) => state.professions)
  const workers = useMasterStore((state) => state.workers)
  const workerWageRates = useMasterStore((state) => state.workerWageRates)
  const staffMembers = useMasterStore((state) => state.staffMembers)
  const fetchProjects = useMasterStore((state) => state.fetchProjects)
  const fetchExpenseCategories = useMasterStore(
    (state) => state.fetchExpenseCategories
  )
  const fetchSuppliers = useMasterStore((state) => state.fetchSuppliers)
  const fetchFundingCreditors = useMasterStore(
    (state) => state.fetchFundingCreditors
  )
  const fetchProfessions = useMasterStore((state) => state.fetchProfessions)
  const fetchWorkers = useMasterStore((state) => state.fetchWorkers)
  const fetchWorkerWageRates = useMasterStore((state) => state.fetchWorkerWageRates)
  const fetchStaff = useMasterStore((state) => state.fetchStaff)
  const isLoading = useMasterStore((state) => state.isLoading)
  const error = useMasterStore((state) => state.error)
  const [activeTab, setActiveTab] = useState(masterTabs[0].key)
  const [feedbackMessage, setFeedbackMessage] = useState(null)

  useEffect(() => {
    void Promise.all([
      fetchProjects(),
      fetchExpenseCategories(),
      fetchSuppliers(),
      fetchFundingCreditors(),
      fetchProfessions(),
      fetchWorkers(),
      fetchWorkerWageRates(),
      fetchStaff(),
    ]).catch((masterError) => {
      console.error('Gagal memuat master data universal:', masterError)
    })
  }, [
    fetchExpenseCategories,
    fetchFundingCreditors,
    fetchProfessions,
    fetchProjects,
    fetchStaff,
    fetchSuppliers,
    fetchWorkerWageRates,
    fetchWorkers,
  ])

  const collections = useMemo(
    () => ({
      projects,
      categories,
      suppliers,
      fundingCreditors,
      professions,
      workers,
      staffMembers,
    }),
    [
      categories,
      fundingCreditors,
      professions,
      projects,
      staffMembers,
      suppliers,
      workers,
    ]
  )

  const professionMap = useMemo(
    () =>
      professions.reduce((map, profession) => {
        map[profession.id] = profession
        return map
      }, {}),
    [professions]
  )

  const workerRatesByWorkerId = useMemo(
    () =>
      workerWageRates.reduce((map, rate) => {
        if (!map[rate.worker_id]) {
          map[rate.worker_id] = []
        }

        map[rate.worker_id].push(rate)
        return map
      }, {}),
    [workerWageRates]
  )

  const currentConfig = masterTabs.find((tab) => tab.key === activeTab) ?? masterTabs[0]
  const currentRecords = collections[currentConfig.stateKey] ?? []

  const openCreateForm = () => {
    setFeedbackMessage(null)
    navigate(`/master/${currentConfig.routeKey}/add`)
  }

  const openEditForm = (record) => {
    setFeedbackMessage(null)
    navigate(`/master/${currentConfig.routeKey}/edit/${record.id}`)
  }

  const handleDelete = async (record) => {
    const confirmed = window.confirm(
      `Yakin ingin menghapus ${currentConfig.label.toLowerCase()} ini?`
    )

    if (!confirmed) {
      return
    }

    const action = useMasterStore.getState()[currentConfig.deleteAction]

    if (typeof action !== 'function') {
      return
    }

    await action(record.id)
    setFeedbackMessage(`${currentConfig.label} berhasil dihapus secara soft delete.`)
  }

  const renderWorkerDescription = (worker) => {
    const professionName =
      professionMap[worker.profession_id]?.profession_name ??
      professionMap[worker.profession_id]?.name ??
      'Profesi belum diisi'
    const rateCount = workerRatesByWorkerId[worker.id]?.length ?? 0

    return `${professionName} | ${worker.status || 'active'} | ${rateCount} tarif upah`
  }

  if (!currentTeamId) {
    return (
      <ProtectedRoute
        allowedRoles={['Owner', 'Admin']}
        description="Master data hanya tersedia untuk Owner dan Admin."
      >
        <section className="rounded-[26px] border border-amber-200 bg-amber-50/85 px-5 py-5 text-amber-950">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
            Workspace Belum Aktif
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
            Team aktif belum tersedia.
          </h2>
          <p className="mt-3 text-sm leading-6 text-amber-800/80">
            Login ulang atau selesaikan onboarding agar manager master data bisa
            memuat workspace yang benar.
          </p>
        </section>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute
      allowedRoles={['Owner', 'Admin']}
      description="Master data universal hanya tersedia untuk Owner dan Admin."
    >
      <section className="space-y-5">
        <div className="rounded-[28px] border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--app-accent-color)]">
                Universal Master Data Manager
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
                Kelola master lintas modul dalam satu layar
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--app-hint-color)]">
                Semua fetch memakai filter `deleted_at is null`, dan aksi hapus selalu
                memakai soft delete agar histori operasional tetap aman.
              </p>
            </div>

            <button
              className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-sky-600 via-cyan-500 to-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition active:scale-[0.99]"
              onClick={openCreateForm}
              type="button"
            >
              <Plus className="h-4 w-4" />
              {currentConfig.createLabel}
            </button>
          </div>

          <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
            {masterTabs.map((tab) => {
              const TabIcon = tab.icon
              const isActive = tab.key === activeTab

              return (
                <button
                  key={tab.key}
                  className={`inline-flex min-w-fit items-center gap-2 rounded-[18px] border px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-sm'
                      : 'border-slate-200 bg-white/85 text-[var(--app-text-color)] hover:bg-white'
                  }`}
                  onClick={() => {
                    setActiveTab(tab.key)
                    setFeedbackMessage(null)
                  }}
                  type="button"
                >
                  <TabIcon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        <section className="rounded-[28px] border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--app-accent-color)]">
                {currentConfig.label}
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
                {currentConfig.description}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">
                {currentRecords.length} data aktif tersedia untuk workspace ini.
              </p>
            </div>

            {isLoading ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-[var(--app-hint-color)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sinkronisasi master data
              </div>
            ) : null}
          </div>

          {feedbackMessage ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
              {feedbackMessage}
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {currentRecords.length > 0 ? (
              currentRecords.map((record) => {
                const workerRates = workerRatesByWorkerId[record.id] ?? []

                return (
                  <article
                    key={record.id}
                    className="rounded-[24px] border border-slate-200 bg-white/90 px-4 py-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-[var(--app-text-color)]">
                            {record.name ||
                              record.project_name ||
                              record.supplier_name ||
                              record.creditor_name ||
                              record.profession_name ||
                              record.staff_name ||
                              record.worker_name ||
                              'Tanpa Nama'}
                          </p>

                          {(currentConfig.getBadges?.(record) ?? []).map((badge) => (
                            <span
                              key={`${record.id}-${badge}`}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                            >
                              {badge}
                            </span>
                          ))}
                        </div>

                        <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">
                          {currentConfig.key === 'workers'
                            ? renderWorkerDescription(record)
                            : currentConfig.getDescription?.(record)}
                        </p>

                        {currentConfig.key === 'workers' && workerRates.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {workerRates.map((rate) => (
                              <span
                                key={rate.id}
                                className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700"
                              >
                                {rate.project_name || 'Proyek'} | {rate.role_name} |{' '}
                                {formatCurrency(rate.wage_amount)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[var(--app-text-color)] transition hover:bg-slate-50"
                          onClick={() => openEditForm(record)}
                          type="button"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>

                        <button
                          className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                          onClick={async () => {
                            try {
                              await handleDelete(record)
                            } catch (deleteError) {
                              console.error('Gagal menghapus master data:', deleteError)
                            }
                          }}
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                          Hapus
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm leading-6 text-[var(--app-hint-color)]">
                {currentConfig.emptyTitle} Gunakan tombol tambah untuk membuat data
                pertama.
              </div>
            )}
          </div>
        </section>

      </section>
    </ProtectedRoute>
  )
}

export default MasterDataManager
