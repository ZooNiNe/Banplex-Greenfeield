import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import useTelegram from '../hooks/useTelegram'
import useAuthStore from '../store/useAuthStore'
import useMasterStore from '../store/useMasterStore'
import useTransactionStore from '../store/useTransactionStore'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function createLineItem() {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    materialId: '',
    qty: '',
    unitPrice: '',
  }
}

function createInitialHeader() {
  return {
    projectId: '',
    supplierName: '',
    date: '',
    description: '',
    documentType: 'faktur',
    paymentStatus: 'paid',
  }
}

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

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

function formatCurrency(value) {
  const amount = Number(value)

  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function getLineTotal(item) {
  const qty = Number(item.qty)
  const unitPrice = Number(item.unitPrice)

  if (!Number.isFinite(qty) || !Number.isFinite(unitPrice)) {
    return 0
  }

  return qty * unitPrice
}

function MaterialInvoiceForm({ onSuccess, formId = null, hideActions = false }) {
  const [header, setHeader] = useState(createInitialHeader)
  const [items, setItems] = useState([createLineItem()])
  const [successMessage, setSuccessMessage] = useState(null)
  const { user } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const projects = useMasterStore((state) => state.projects)
  const materials = useMasterStore((state) => state.materials)
  const isMasterLoading = useMasterStore((state) => state.isLoading)
  const masterError = useMasterStore((state) => state.error)
  const fetchMasters = useMasterStore((state) => state.fetchMasters)
  const submitMaterialInvoice = useTransactionStore(
    (state) => state.submitMaterialInvoice
  )
  const isSubmitting = useTransactionStore((state) => state.isSubmitting)
  const error = useTransactionStore((state) => state.error)
  const clearError = useTransactionStore((state) => state.clearError)
  const totalAmount = items.reduce((sum, item) => sum + getLineTotal(item), 0)
  const isDeliveryOrder = header.documentType === 'surat_jalan'
  const isMasterDataReady =
    !isMasterLoading && projects.length > 0 && materials.length > 0

  useEffect(() => {
    fetchMasters().catch((fetchError) => {
      console.error('Gagal memuat master data faktur material:', fetchError)
    })
  }, [fetchMasters])

  useEffect(() => () => clearError(), [clearError])

  const handleHeaderChange = (event) => {
    const { name, value } = event.target

    setHeader((current) => ({
      ...current,
      [name]: value,
      ...(name === 'documentType' && value === 'surat_jalan'
        ? { paymentStatus: 'paid' }
        : {}),
    }))

    if (error) {
      clearError()
    }

    if (successMessage) {
      setSuccessMessage(null)
    }
  }

  const handleItemChange = (itemId, field, value) => {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    )

    if (error) {
      clearError()
    }

    if (successMessage) {
      setSuccessMessage(null)
    }
  }

  const handleAddItem = () => {
    setItems((current) => [...current, createLineItem()])
  }

  const handleRemoveItem = (itemId) => {
    setItems((current) =>
      current.length > 1
        ? current.filter((item) => item.id !== itemId)
        : current
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (isSubmitting || !isMasterDataReady) {
      return
    }

    try {
      const selectedProject = projects.find((project) => project.id === header.projectId)
      const mappedItems = items.map((item) => {
        const selectedMaterial = materials.find(
          (material) => material.id === item.materialId
        )

        return {
          material_id: item.materialId,
          item_name: selectedMaterial?.name ?? '',
          qty: item.qty,
          unit_price: isDeliveryOrder ? 0 : item.unitPrice,
        }
      })

      await submitMaterialInvoice(
        {
          telegram_user_id: user?.id ?? authUser?.telegram_user_id ?? null,
          userName: getUserDisplayName(user, authUser),
          project_id: header.projectId,
          project_name: selectedProject?.name ?? null,
          supplier_name: header.supplierName,
          document_type: header.documentType,
          status: header.paymentStatus,
          expense_date: header.date,
          description: normalizeText(
            header.description,
            isDeliveryOrder ? 'Surat jalan material baru' : 'Faktur material baru'
          ),
        },
        mappedItems
      )

      setHeader(createInitialHeader())
      setItems([createLineItem()])
      setSuccessMessage(
        isDeliveryOrder
          ? 'Surat jalan material berhasil disimpan.'
          : 'Faktur material berhasil disimpan.'
      )

      if (typeof onSuccess === 'function') {
        await onSuccess()
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan faktur material.'

      console.error(message)
    }
  }

  return (
    <form id={formId ?? undefined} className="space-y-6" onSubmit={handleSubmit}>
      <fieldset className="space-y-6" disabled={isSubmitting}>
        <section className="space-y-4 rounded-[26px] border border-slate-200 bg-white/75 p-4 sm:p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--app-accent-color)]">
              Header Faktur
            </p>
            <p className="text-sm text-[var(--app-hint-color)]">
              Isi identitas proyek, supplier, dan tanggal invoice material.
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Proyek
            </span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              name="projectId"
              onChange={handleHeaderChange}
              required
              value={header.projectId}
            >
              {isMasterLoading ? (
                <option value="">Memuat proyek...</option>
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
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Supplier
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                name="supplierName"
                onChange={handleHeaderChange}
                placeholder="Contoh: CV Sumber Baja"
                required
                type="text"
                value={header.supplierName}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Jenis Dokumen
              </span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                name="documentType"
                onChange={handleHeaderChange}
                value={header.documentType}
              >
                <option value="faktur">Faktur</option>
                <option value="surat_jalan">Surat Jalan</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Tanggal
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                name="date"
                onChange={handleHeaderChange}
                required
                type="date"
                value={header.date}
              />
            </label>
          </div>

          {isDeliveryOrder ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-800">
              Mode surat jalan mencatat material keluar dari stok. Nilai transaksi dan
              bill akan menunggu faktur resmi.
            </div>
          ) : (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Status Pembayaran
              </span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                name="paymentStatus"
                onChange={handleHeaderChange}
                value={header.paymentStatus}
              >
                <option value="paid">Lunas (Cash)</option>
                <option value="unpaid">Hutang (Tempo)</option>
              </select>
              <p className="text-sm leading-6 text-[var(--app-hint-color)]">
                Status ini menentukan apakah sistem otomatis membuat bill lunas
                atau hutang.
              </p>
            </label>
          )}

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Catatan Faktur
            </span>
            <textarea
              className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              name="description"
              onChange={handleHeaderChange}
              placeholder="Tambahkan konteks singkat untuk invoice material ini."
              value={header.description}
            />
          </label>
        </section>

        <section className="space-y-4 rounded-[26px] border border-slate-200 bg-slate-950 px-4 py-5 text-white sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-200">
                Line Items
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Tambahkan material sebanyak yang dibutuhkan pada faktur ini.
              </p>
            </div>

            <button
              className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              onClick={handleAddItem}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Tambah Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const selectedMaterial = materials.find(
                (material) => material.id === item.materialId
              )
              const lineTotal = getLineTotal(item)

              return (
                <article
                  key={item.id}
                  className="rounded-[24px] border border-white/10 bg-white/5 p-4"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Item {index + 1}
                      </p>
                      <p className="text-xs text-slate-300">
                        {selectedMaterial?.unit
                          ? `Satuan: ${selectedMaterial.unit}`
                          : isDeliveryOrder
                            ? 'Pilih material dan qty barang yang diterima.'
                            : 'Pilih material, qty, dan harga satuan.'}
                      </p>
                    </div>

                    <button
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-slate-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={items.length === 1}
                      onClick={() => handleRemoveItem(item.id)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-3">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-200">
                        Material
                      </span>
                      <select
                        className="w-full rounded-2xl border border-white/10 bg-white/90 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                        onChange={(event) =>
                          handleItemChange(item.id, 'materialId', event.target.value)
                        }
                        required
                        value={item.materialId}
                      >
                        {isMasterLoading ? (
                          <option value="">Memuat material...</option>
                        ) : materials.length > 0 ? (
                          <>
                            <option value="">Pilih material</option>
                            {materials.map((material) => (
                              <option key={material.id} value={material.id}>
                                {material.name}
                              </option>
                            ))}
                          </>
                        ) : (
                          <option value="">Data material belum tersedia</option>
                        )}
                      </select>
                    </label>

                    <div className={`grid gap-3 ${isDeliveryOrder ? '' : 'sm:grid-cols-2'}`}>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-200">
                          Qty
                        </span>
                        <input
                          className="w-full rounded-2xl border border-white/10 bg-white/90 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                          inputMode="decimal"
                          min="0.01"
                          onChange={(event) =>
                            handleItemChange(item.id, 'qty', event.target.value)
                          }
                          placeholder="0"
                          required
                          step="0.01"
                          type="number"
                          value={item.qty}
                        />
                      </label>

                      {isDeliveryOrder ? null : (
                        <label className="block space-y-2">
                          <span className="text-sm font-medium text-slate-200">
                            Harga Satuan
                          </span>
                          <input
                            className="w-full rounded-2xl border border-white/10 bg-white/90 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                            inputMode="decimal"
                            min="0.01"
                            onChange={(event) =>
                              handleItemChange(item.id, 'unitPrice', event.target.value)
                            }
                            placeholder="Rp 0"
                            required
                            step="0.01"
                            type="number"
                            value={item.unitPrice}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {isDeliveryOrder ? null : (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
                        Subtotal
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {formatCurrency(lineTotal)}
                      </p>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        <section className="space-y-4 rounded-[26px] border border-emerald-200 bg-emerald-50/85 p-4 sm:p-5">
          {isDeliveryOrder ? (
            <div className="rounded-2xl bg-white/80 px-4 py-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Ringkasan Surat Jalan
              </p>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                {items.length} item material akan dicatat sebagai barang masuk tanpa
                nilai faktur.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Total Keseluruhan
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-emerald-800">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Jumlah Item
                </p>
                <p className="mt-1 text-lg font-semibold text-[var(--app-text-color)]">
                  {items.length}
                </p>
              </div>
            </div>
          )}

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

          {materials.length === 0 && !isMasterLoading ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              Data material masih kosong. Tambahkan master material di database
              agar faktur bisa disimpan.
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-2xl border border-emerald-200 bg-white/80 px-4 py-3 text-sm leading-6 text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          {hideActions ? null : (
            <button
              className="flex w-full items-center justify-center rounded-[22px] bg-slate-950 px-5 py-4 text-base font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || !isMasterDataReady}
              type="submit"
            >
              {isSubmitting
                ? isDeliveryOrder
                  ? 'Menyimpan Surat Jalan...'
                  : 'Menyimpan Faktur...'
                : isDeliveryOrder
                  ? 'Simpan Surat Jalan'
                  : 'Simpan Faktur Material'}
            </button>
          )}
        </section>
      </fieldset>
    </form>
  )
}

export default MaterialInvoiceForm
