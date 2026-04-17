import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import useMasterStore from '../store/useMasterStore'

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function createEmptyWageRate() {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    projectId: '',
    roleName: '',
    wageAmount: '',
    isDefault: false,
  }
}

function buildInitialState(worker, wageRates = []) {
  return {
    name: worker?.worker_name ?? worker?.name ?? '',
    telegramUserId: worker?.telegram_user_id ?? '',
    professionId: worker?.profession_id ?? '',
    status: worker?.status ?? 'active',
    defaultProjectId: worker?.default_project_id ?? '',
    defaultRoleName: worker?.default_role_name ?? '',
    notes: worker?.notes ?? '',
    wageRates:
      wageRates.length > 0
        ? wageRates.map((rate) => ({
            id: rate.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            projectId: rate.project_id ?? '',
            roleName: rate.role_name ?? '',
            wageAmount: rate.wage_amount != null ? String(rate.wage_amount) : '',
            isDefault: Boolean(rate.is_default),
          }))
        : [createEmptyWageRate()],
  }
}

function WorkerForm({
  initialWorker = null,
  initialWageRates = [],
  isSubmitting = false,
  onCancel,
  formId = null,
  hideActions = false,
  onSubmit,
}) {
  const [formState, setFormState] = useState(() =>
    buildInitialState(initialWorker, initialWageRates)
  )
  const [localError, setLocalError] = useState(null)
  const projects = useMasterStore((state) => state.projects)
  const professions = useMasterStore((state) => state.professions)
  const fetchProjects = useMasterStore((state) => state.fetchProjects)
  const fetchProfessions = useMasterStore((state) => state.fetchProfessions)

  useEffect(() => {
    void Promise.all([
      fetchProjects().catch((error) => {
        console.error('Gagal memuat proyek untuk form pekerja:', error)
      }),
      fetchProfessions().catch((error) => {
        console.error('Gagal memuat profesi untuk form pekerja:', error)
      }),
    ])
  }, [fetchProfessions, fetchProjects])

  const selectedDefaultProjectName = useMemo(() => {
    return (
      projects.find((project) => project.id === formState.defaultProjectId)?.name ?? null
    )
  }, [formState.defaultProjectId, projects])

  const handleFieldChange = (event) => {
    const { name, value } = event.target

    setFormState((current) => ({
      ...current,
      [name]: value,
    }))

    if (localError) {
      setLocalError(null)
    }
  }

  const handleWageRateChange = (rateId, field, value) => {
    setFormState((current) => ({
      ...current,
      wageRates: current.wageRates.map((rate) => {
        if (rate.id !== rateId) {
          return field === 'isDefault' && value ? { ...rate, isDefault: false } : rate
        }

        return {
          ...rate,
          [field]: value,
        }
      }),
    }))

    if (localError) {
      setLocalError(null)
    }
  }

  const handleAddWageRate = () => {
    setFormState((current) => ({
      ...current,
      wageRates: [...current.wageRates, createEmptyWageRate()],
    }))
  }

  const handleRemoveWageRate = (rateId) => {
    setFormState((current) => ({
      ...current,
      wageRates:
        current.wageRates.length > 1
          ? current.wageRates.filter((rate) => rate.id !== rateId)
          : current.wageRates,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const workerName = normalizeText(formState.name)

    if (!workerName) {
      setLocalError('Nama pekerja wajib diisi.')
      return
    }

    const normalizedWageRates = formState.wageRates
      .map((rate) => ({
        project_id: normalizeText(rate.projectId),
        role_name: normalizeText(rate.roleName),
        wage_amount: Number(rate.wageAmount),
        is_default: Boolean(rate.isDefault),
      }))
      .filter((rate) => rate.project_id || rate.role_name || rate.wage_amount)

    for (const [index, rate] of normalizedWageRates.entries()) {
      if (!rate.project_id) {
        setLocalError(`Proyek pada baris upah ${index + 1} wajib dipilih.`)
        return
      }

      if (!rate.role_name) {
        setLocalError(`Role pada baris upah ${index + 1} wajib diisi.`)
        return
      }

      if (!Number.isFinite(rate.wage_amount) || rate.wage_amount <= 0) {
        setLocalError(`Nominal upah pada baris ${index + 1} harus lebih dari 0.`)
        return
      }
    }

    try {
      await onSubmit?.({
        worker_name: workerName,
        telegram_user_id: normalizeText(formState.telegramUserId, null),
        profession_id: normalizeText(formState.professionId, null),
        status: normalizeText(formState.status, 'active'),
        default_project_id: normalizeText(formState.defaultProjectId, null),
        default_role_name: normalizeText(formState.defaultRoleName, null),
        notes: normalizeText(formState.notes, null),
        wage_rates: normalizedWageRates,
      })
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : 'Gagal menyimpan data pekerja.'
      )
    }
  }

  return (
    <form id={formId ?? undefined} className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Nama Pekerja
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            name="name"
            onChange={handleFieldChange}
            placeholder="Contoh: Budi Santoso"
            value={formState.name}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Telegram User ID
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            name="telegramUserId"
            onChange={handleFieldChange}
            placeholder="Opsional"
            value={formState.telegramUserId}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Profesi
          </span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            name="professionId"
            onChange={handleFieldChange}
            value={formState.professionId}
          >
            <option value="">Pilih profesi</option>
            {professions.map((profession) => (
              <option key={profession.id} value={profession.id}>
                {profession.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Status
          </span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            name="status"
            onChange={handleFieldChange}
            value={formState.status}
          >
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Proyek Default
          </span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            name="defaultProjectId"
            onChange={handleFieldChange}
            value={formState.defaultProjectId}
          >
            <option value="">Pilih proyek default</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Role Default
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            name="defaultRoleName"
            onChange={handleFieldChange}
            placeholder={
              selectedDefaultProjectName
                ? `Contoh role di ${selectedDefaultProjectName}`
                : 'Contoh: Tukang Besi'
            }
            value={formState.defaultRoleName}
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-[var(--app-text-color)]">
          Catatan
        </span>
        <textarea
          className="min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          name="notes"
          onChange={handleFieldChange}
          placeholder="Tambahkan catatan jika diperlukan."
          value={formState.notes}
        />
      </label>

      <section className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
              Upah Per Proyek
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Tambahkan role dan upah pekerja untuk proyek yang berbeda.
            </p>
          </div>

          <button
            className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
            onClick={handleAddWageRate}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Tambah Upah
          </button>
        </div>

        <div className="space-y-3">
          {formState.wageRates.map((rate, index) => (
            <article
              key={rate.id}
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  Upah #{index + 1}
                </p>

                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={formState.wageRates.length === 1}
                  onClick={() => handleRemoveWageRate(rate.id)}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Proyek</span>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    onChange={(event) =>
                      handleWageRateChange(rate.id, 'projectId', event.target.value)
                    }
                    value={rate.projectId}
                  >
                    <option value="">Pilih proyek</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">Role</span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                      onChange={(event) =>
                        handleWageRateChange(rate.id, 'roleName', event.target.value)
                      }
                      placeholder="Contoh: Tukang"
                      value={rate.roleName}
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Nominal Upah
                    </span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                      inputMode="decimal"
                      min="0"
                      onChange={(event) =>
                        handleWageRateChange(rate.id, 'wageAmount', event.target.value)
                      }
                      placeholder="0"
                      step="0.01"
                      type="number"
                      value={rate.wageAmount}
                    />
                  </label>
                </div>

                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    checked={rate.isDefault}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    onChange={(event) =>
                      handleWageRateChange(rate.id, 'isDefault', event.target.checked)
                    }
                    type="checkbox"
                  />
                  Jadikan default untuk kombinasi proyek-role ini
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>

      {localError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          {localError}
        </div>
      ) : null}

      {hideActions ? null : (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex items-center justify-center rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[var(--app-text-color)]"
            onClick={onCancel}
            type="button"
          >
            Batal
          </button>

          <button
            className="inline-flex items-center justify-center rounded-[20px] bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Pekerja'}
          </button>
        </div>
      )}
    </form>
  )
}

export default WorkerForm
