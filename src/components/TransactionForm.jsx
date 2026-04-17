import { useEffect, useEffectEvent, useState } from 'react'
import useTelegram from '../hooks/useTelegram'
import useAuthStore from '../store/useAuthStore'
import useMasterStore from '../store/useMasterStore'
import useTransactionStore from '../store/useTransactionStore'

const transactionTypes = [
  { value: 'income', label: 'Pemasukan' },
  { value: 'expense', label: 'Pengeluaran' },
]

function getUserDisplayName(user, authUser) {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()

  if (fullName) {
    return fullName
  }

  if (user?.username) {
    return `@${user.username}`
  }

  if (authUser?.name) {
    return authUser.name
  }

  if (authUser?.telegram_user_id) {
    return authUser.telegram_user_id
  }

  return 'Pengguna Telegram'
}

function createInitialFormData(initialType = 'income') {
  return {
    type: initialType === 'expense' ? 'expense' : 'income',
    projectId: '',
    categoryId: '',
    amount: '',
    date: '',
    description: '',
    notes: '',
  }
}

function InlineSelectLoader() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center gap-2 text-xs font-medium text-slate-400">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
      <span className="hidden sm:inline">Memuat data...</span>
    </div>
  )
}

function TransactionForm({ initialType = 'income', onSuccess }) {
  const [formData, setFormData] = useState(() => createInitialFormData(initialType))
  const [successMessage, setSuccessMessage] = useState(null)
  const { tg, user } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const projects = useMasterStore((state) => state.projects)
  const categories = useMasterStore((state) => state.categories)
  const isMasterLoading = useMasterStore((state) => state.isLoading)
  const masterError = useMasterStore((state) => state.error)
  const fetchMasters = useMasterStore((state) => state.fetchMasters)
  const submitTransaction = useTransactionStore((state) => state.submitTransaction)
  const isSubmitting = useTransactionStore((state) => state.isSubmitting)
  const error = useTransactionStore((state) => state.error)
  const clearError = useTransactionStore((state) => state.clearError)
  const hasMainButton = Boolean(tg?.MainButton)
  const selectedProject = projects.find((project) => project.id === formData.projectId)
  const selectedCategory = categories.find((category) => category.id === formData.categoryId)
  const isMasterDataReady = !isMasterLoading && projects.length > 0 && categories.length > 0
  const isProjectDisabled = isSubmitting || isMasterLoading || projects.length === 0
  const isCategoryDisabled = isSubmitting || isMasterLoading || categories.length === 0

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))

    if (error) {
      clearError()
    }

    if (successMessage) {
      setSuccessMessage(null)
    }
  }

  const saveTransaction = async () => {
    if (isSubmitting || !isMasterDataReady) {
      return
    }

    try {
      setSuccessMessage(null)

      await submitTransaction({
        telegram_user_id: user?.id ?? authUser?.telegram_user_id ?? null,
        userName: getUserDisplayName(user, authUser),
        type: formData.type,
        project_id: formData.projectId,
        project_name: selectedProject?.name ?? null,
        expense_category_id: formData.categoryId,
        category_name: selectedCategory?.name ?? null,
        amount: formData.amount,
        transaction_date: formData.date,
        description: formData.description,
        notes: formData.notes,
      })

      if (tg?.close) {
        tg.close()
        return
      }

      await onSuccess?.()
      setFormData(createInitialFormData())
      setSuccessMessage('Transaksi berhasil disimpan ke database.')
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan transaksi.'

      tg?.showAlert?.(message)
    }
  }

  const handleSave = useEffectEvent(() => {
    void saveTransaction()
  })

  const handleSubmit = (event) => {
    event.preventDefault()
    void saveTransaction()
  }

  useEffect(() => {
    fetchMasters().catch((fetchError) => {
      console.error('Gagal memuat master data transaksi:', fetchError)
    })
  }, [fetchMasters])

  useEffect(() => {
    if (!tg?.MainButton) {
      return undefined
    }

    tg.MainButton.setText('SIMPAN TRANSAKSI')
    tg.MainButton.show()
    tg.onEvent?.('mainButtonClicked', handleSave)

    return () => {
      tg.offEvent?.('mainButtonClicked', handleSave)
      tg.MainButton.hide()
    }
  }, [tg])

  useEffect(() => {
    if (!tg?.MainButton) {
      return
    }

    if (!isMasterDataReady) {
      tg.MainButton.setText('MEMUAT DATA...')
      tg.MainButton.disable()
      return
    }

    if (isSubmitting) {
      tg.MainButton.setText('MENYIMPAN...')
      tg.MainButton.disable()
      return
    }

    tg.MainButton.setText('SIMPAN TRANSAKSI')
    tg.MainButton.enable()
  }, [isMasterDataReady, isSubmitting, tg])

  useEffect(() => () => clearError(), [clearError])

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit}
    >
      <fieldset className="space-y-5" disabled={isSubmitting}>
        <section className="space-y-2">
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            Tipe Transaksi
          </p>
          <div className="grid grid-cols-2 gap-3">
            {transactionTypes.map((type) => (
              <label
                key={type.value}
                className={`flex cursor-pointer items-center justify-center rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                  formData.type === type.value
                    ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm'
                    : 'border-slate-200 bg-white/80 text-slate-600'
                }`}
              >
                <input
                  checked={formData.type === type.value}
                  className="sr-only"
                  name="type"
                  onChange={handleChange}
                  type="radio"
                  value={type.value}
                />
                {type.label}
              </label>
            ))}
          </div>
        </section>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Proyek
          </span>
          <div className="relative">
            <select
              className={`w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 pr-14 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 ${
                isMasterLoading ? 'animate-pulse' : ''
              }`}
              disabled={isProjectDisabled}
              name="projectId"
              onChange={handleChange}
              required
              value={formData.projectId}
            >
              {isMasterLoading ? (
                <option value="">Memuat data...</option>
              ) : projects.length > 0 ? (
                <>
                  <option value="">Pilih proyek</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </>
              ) : (
                <option value="">Data proyek belum tersedia</option>
              )}
            </select>

            {isMasterLoading ? <InlineSelectLoader /> : null}
          </div>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Kategori
          </span>
          <div className="relative">
            <select
              className={`w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 pr-14 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 ${
                isMasterLoading ? 'animate-pulse' : ''
              }`}
              disabled={isCategoryDisabled}
              name="categoryId"
              onChange={handleChange}
              required
              value={formData.categoryId}
            >
              {isMasterLoading ? (
                <option value="">Memuat data...</option>
              ) : categories.length > 0 ? (
                <>
                  <option value="">Pilih kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </>
              ) : (
                <option value="">Data kategori belum tersedia</option>
              )}
            </select>

            {isMasterLoading ? <InlineSelectLoader /> : null}
          </div>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Nominal
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            inputMode="decimal"
            min="0.01"
            name="amount"
            onChange={handleChange}
            placeholder="Rp 0"
            required
            step="0.01"
            type="number"
            value={formData.amount}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Tanggal
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            name="date"
            onChange={handleChange}
            required
            type="date"
            value={formData.date}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Deskripsi Singkat
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            name="description"
            onChange={handleChange}
            placeholder="Contoh: Pembayaran invoice proyek"
            type="text"
            value={formData.description}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Catatan Tambahan
          </span>
          <textarea
            className="min-h-32 w-full resize-none rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            name="notes"
            onChange={handleChange}
            placeholder="Tambahkan konteks singkat untuk transaksi ini."
            value={formData.notes}
          />
        </label>

        <div
          className={`rounded-2xl border border-dashed px-4 py-3 text-sm leading-6 ${
            hasMainButton
              ? 'border-sky-200 bg-sky-50/80 text-sky-800'
              : 'border-amber-200 bg-amber-50/80 text-amber-800'
          }`}
        >
          {hasMainButton
            ? 'Gunakan MainButton Telegram untuk menyimpan transaksi ini.'
            : 'MainButton Telegram tidak tersedia di browser. Gunakan tombol manual di bawah untuk menyimpan transaksi.'}
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
            {error}
          </div>
        ) : null}

        {masterError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            {masterError}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {!hasMainButton ? (
          <button
            className="flex w-full items-center justify-center rounded-[22px] bg-slate-950 px-5 py-4 text-base font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting || !isMasterDataReady}
            type="submit"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
          </button>
        ) : null}
      </fieldset>
    </form>
  )
}

export default TransactionForm
