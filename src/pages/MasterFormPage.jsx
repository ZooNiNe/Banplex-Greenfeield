import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FormLayout from '../components/layouts/FormLayout'
import ProtectedRoute from '../components/ProtectedRoute'
import WorkerForm from '../components/WorkerForm'
import GenericMasterForm from '../components/master/GenericMasterForm'
import { masterTabs } from '../components/master/masterTabs'
import useAuthStore from '../store/useAuthStore'
import useMasterStore from '../store/useMasterStore'

function getRouteTab(routeTab) {
  const normalizedValue = String(routeTab ?? '').trim().toLowerCase()

  return (
    masterTabs.find(
      (tab) =>
        tab.routeKey === normalizedValue ||
        tab.key === normalizedValue ||
        tab.key.replace(/s$/, '') === normalizedValue
    ) ?? null
  )
}

function MasterFormPage() {
  const navigate = useNavigate()
  const params = useParams()
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
  const masterError = useMasterStore((state) => state.error)

  const tabConfig = useMemo(() => getRouteTab(params.tab), [params.tab])
  const recordId = String(params.id ?? '').trim()
  const isEditMode = recordId.length > 0
  const formId = `${tabConfig?.key ?? 'master'}-form`
  const formKey = `${tabConfig?.key ?? 'master'}-${recordId || 'new'}-${
    (currentTeamId ?? 'workspace')
  }`

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

  const currentRecord = tabConfig
    ? collections[tabConfig.stateKey]?.find((record) => String(record.id) === recordId) ?? null
    : null

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
    ]).catch((error) => {
      console.error('Gagal memuat master form:', error)
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

  const handleBack = () => {
    navigate('/master')
  }

  const handleSubmit = async (payload) => {
    if (!tabConfig) {
      throw new Error('Konfigurasi master data tidak ditemukan.')
    }

    const actionName = isEditMode ? tabConfig.updateAction : tabConfig.createAction
    const action = useMasterStore.getState()[actionName]

    if (typeof action !== 'function') {
      throw new Error('Aksi master data tidak tersedia.')
    }

    if (isEditMode) {
      await action(recordId, payload)
    } else {
      await action({
        ...payload,
        team_id: currentTeamId,
      })
    }

    navigate('/master', { replace: true })
  }

  if (!tabConfig) {
    return (
      <ProtectedRoute allowedRoles={['Owner', 'Admin']} description="Master form tidak tersedia.">
        <section className="app-page-surface px-4 py-4">
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            Form master tidak ditemukan.
          </p>
        </section>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute
      allowedRoles={['Owner', 'Admin']}
      description="Form master hanya tersedia untuk Owner dan Admin."
    >
      <FormLayout
        actionLabel={isEditMode ? 'Simpan Perubahan' : tabConfig.createLabel}
        formId={formId}
        isSubmitting={isLoading}
        onBack={handleBack}
        submitDisabled={Boolean(masterError)}
        title={`${isEditMode ? 'Edit' : 'Tambah'} ${tabConfig.label}`}
      >
        <section className="space-y-4">
          <div className="app-page-surface p-4">
            <p className="app-kicker">
              Master Data
            </p>
            <h2 className="app-title">
              {tabConfig.description}
            </h2>
            <p className="app-copy">
              {isEditMode
                ? 'Ubah data yang sudah tersimpan tanpa modal.'
                : 'Tambahkan data baru dalam layar penuh yang aman di mobile.'}
            </p>
          </div>

          {tabConfig.customForm === 'worker' ? (
            <WorkerForm
              key={`${formKey}-${workerRatesByWorkerId[recordId]?.length ?? 0}`}
              formId={formId}
              hideActions
              initialWageRates={workerRatesByWorkerId[currentRecord?.id] ?? []}
              initialWorker={currentRecord}
              isSubmitting={isLoading}
              onSubmit={handleSubmit}
            />
          ) : (
            <GenericMasterForm
              key={formKey}
              config={tabConfig}
              formId={formId}
              hideActions
              initialData={currentRecord}
              isSubmitting={isLoading}
              onSubmit={handleSubmit}
            />
          )}
        </section>
      </FormLayout>
    </ProtectedRoute>
  )
}

export default MasterFormPage
