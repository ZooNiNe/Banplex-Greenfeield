import { useEffect, useState } from 'react'
import { Pencil, Plus, RefreshCcw, Trash2 } from 'lucide-react'
import useHrStore, { beneficiaryStatusOptions } from '../store/useHrStore'

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function formatDate(value) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return '-'
  }

  const parsedDate = new Date(`${normalizedValue}T00:00:00`)

  if (Number.isNaN(parsedDate.getTime())) {
    return normalizedValue
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate)
}

function getStatusStyles(status) {
  if (status === 'pending') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }

  if (status === 'inactive') {
    return 'border-slate-200 bg-slate-100 text-slate-600'
  }

  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function createInitialFormData() {
  return {
    name: '',
    nik: '',
    institution: '',
    status: 'active',
    notes: '',
  }
}

function BeneficiaryList() {
  const [formData, setFormData] = useState(createInitialFormData)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [localError, setLocalError] = useState(null)
  const beneficiaries = useHrStore((state) => state.beneficiaries)
  const isLoading = useHrStore((state) => state.isLoading)
  const isSubmitting = useHrStore((state) => state.isSubmitting)
  const error = useHrStore((state) => state.error)
  const clearError = useHrStore((state) => state.clearError)
  const fetchBeneficiaries = useHrStore((state) => state.fetchBeneficiaries)
  const addBeneficiary = useHrStore((state) => state.addBeneficiary)
  const updateBeneficiary = useHrStore((state) => state.updateBeneficiary)
  const deleteBeneficiary = useHrStore((state) => state.deleteBeneficiary)

  useEffect(() => {
    fetchBeneficiaries({ force: true }).catch((fetchError) => {
      console.error('Gagal memuat penerima manfaat:', fetchError)
    })
  }, [fetchBeneficiaries])

  useEffect(() => {
    if (!isModalOpen) {
      setFormData(createInitialFormData())
      setEditingId(null)
      setLocalError(null)
      clearError()
    }
  }, [clearError, isModalOpen])

  const openCreateModal = () => {
    setEditingId(null)
    setFormData(createInitialFormData())
    setIsModalOpen(true)
  }

  const openEditModal = (beneficiary) => {
    setEditingId(beneficiary.id)
    setFormData({
      name: beneficiary.name ?? '',
      nik: beneficiary.nik ?? '',
      institution: beneficiary.institution ?? '',
      status: beneficiary.status ?? 'active',
      notes: beneficiary.notes ?? '',
    })
    setLocalError(null)
    setIsModalOpen(true)
  }

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))

    if (localError) {
      setLocalError(null)
    }

    if (error) {
      clearError()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const name = normalizeText(formData.name)
    const nik = normalizeText(formData.nik, '')
    const institution = normalizeText(formData.institution, '')
    const status = normalizeText(formData.status, 'active')
    const notes = normalizeText(formData.notes, '')

    if (!name) {
      setLocalError('Nama penerima manfaat wajib diisi.')
      return
    }

    try {
      if (editingId) {
        await updateBeneficiary(editingId, {
          name,
          nik,
          institution,
          status,
          notes,
        })
      } else {
        await addBeneficiary({
          name,
          nik,
          institution,
          status,
          notes,
        })
      }

      await fetchBeneficiaries({ force: true })

      setIsModalOpen(false)
      setEditingId(null)
      setFormData(createInitialFormData())
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan data penerima manfaat.'

      setLocalError(message)
    }
  }

  return (
    <section className="space-y-6 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--app-accent-color)]">
            Data Penerima Manfaat
          </p>
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
            Daftar penerima manfaat
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-[var(--app-hint-color)]">
            Kelola data penerima manfaat secara sederhana dengan tabel, tambah,
            edit, dan hapus langsung dari modal ini.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-[var(--app-text-color)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={() => {
              void fetchBeneficiaries({ force: true }).catch((fetchError) => {
                console.error('Gagal memuat ulang penerima manfaat:', fetchError)
              })
            }}
            type="button"
          >
            <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-sky-600 via-cyan-500 to-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition active:scale-[0.99]"
            onClick={openCreateModal}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Tambah Data
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          {error}
        </div>
      ) : null}

      {isLoading && beneficiaries.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white/80 px-4 py-5 text-sm text-[var(--app-hint-color)]">
          Memuat data penerima manfaat...
        </div>
      ) : beneficiaries.length > 0 ? (
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white/85 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Nama
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    NIK
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Instansi
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {beneficiaries.map((beneficiary) => (
                  <tr key={beneficiary.id} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-[var(--app-text-color)]">
                        {beneficiary.name}
                      </div>
                      <div className="mt-1 text-xs text-[var(--app-hint-color)]">
                        Dicatat {formatDate(beneficiary.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {beneficiary.nik || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {beneficiary.institution || '-'}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusStyles(
                          beneficiary.status
                        )}`}
                      >
                        {beneficiary.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          disabled={isSubmitting}
                          onClick={() => openEditModal(beneficiary)}
                          type="button"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isSubmitting}
                          onClick={() => {
                            void deleteBeneficiary(beneficiary.id).catch((deleteError) => {
                              console.error('Gagal menghapus penerima manfaat:', deleteError)
                            })
                          }}
                          type="button"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm leading-6 text-[var(--app-hint-color)]">
          Belum ada data penerima manfaat. Tambahkan data pertama untuk memulai.
        </div>
      )}

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-3 py-4 sm:items-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsModalOpen(false)
            }
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-white/60 bg-[var(--app-surface-color)] shadow-telegram backdrop-blur-xl">
            <div className="border-b border-white/70 px-5 py-5">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-[var(--app-accent-color)]">
                Data Penerima Manfaat
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
                {editingId ? 'Edit Data' : 'Tambah Data Baru'}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">
                Masukkan biodata dasar penerima manfaat agar data lebih rapi.
              </p>
            </div>

            <form className="space-y-5 px-5 py-5" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Nama
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  name="name"
                  onChange={handleChange}
                  placeholder="Contoh: Siti Aminah"
                  required
                  type="text"
                  value={formData.name}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--app-text-color)]">
                    NIK
                  </span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    name="nik"
                    onChange={handleChange}
                    placeholder="Nomor KTP"
                    type="text"
                    value={formData.nik}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--app-text-color)]">
                    Instansi
                  </span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    name="institution"
                    onChange={handleChange}
                    placeholder="Contoh: Yayasan Mandiri"
                    type="text"
                    value={formData.institution}
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Status
                </span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  name="status"
                  onChange={handleChange}
                  value={formData.status}
                >
                  {beneficiaryStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Catatan
                </span>
                <textarea
                  className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  name="notes"
                  onChange={handleChange}
                  placeholder="Opsional"
                  value={formData.notes}
                />
              </label>

              {localError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                  {localError}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className="inline-flex items-center justify-center rounded-[22px] border border-slate-200 bg-white/85 px-5 py-4 text-base font-semibold text-[var(--app-text-color)] transition hover:bg-white"
                  onClick={() => setIsModalOpen(false)}
                  type="button"
                >
                  Batal
                </button>

                <button
                  className="inline-flex items-center justify-center rounded-[22px] bg-slate-950 px-5 py-4 text-base font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default BeneficiaryList
