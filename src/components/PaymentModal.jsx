import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import useAuthStore from '../store/useAuthStore'
import usePaymentStore from '../store/usePaymentStore'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatCurrency(value) {
  const amount = Number(value)

  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function createInitialForm(bill) {
  return {
    amount: bill?.remainingAmount ? String(bill.remainingAmount) : '',
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: '',
  }
}

function PaymentModal({ bill, onClose, userName = 'Pengguna Telegram' }) {
  const [formData, setFormData] = useState(() => createInitialForm(bill))
  const authUser = useAuthStore((state) => state.user)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const submitBillPayment = usePaymentStore((state) => state.submitBillPayment)
  const isSubmitting = usePaymentStore((state) => state.isSubmitting)
  const error = usePaymentStore((state) => state.error)
  const clearError = usePaymentStore((state) => state.clearError)

  useEffect(() => {
    setFormData(createInitialForm(bill))
  }, [bill])

  useEffect(() => () => clearError(), [clearError])

  if (!bill) {
    return null
  }

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))

    if (error) {
      clearError()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      await submitBillPayment({
        bill_id: bill.id,
        telegram_user_id: authUser?.telegram_user_id ?? null,
        team_id: currentTeamId ?? bill.teamId,
        amount: formData.amount,
        maxAmount: bill.remainingAmount,
        payment_date: formData.paymentDate,
        notes: formData.notes,
        userName,
        supplierName: bill.supplierName,
        projectName: bill.projectName,
        remainingAmount: Math.max(
          Number(bill.remainingAmount ?? 0) - Number(formData.amount ?? 0),
          0
        ),
      })

      onClose()
    } catch (submitError) {
      console.error('Gagal menyimpan pembayaran:', submitError)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-3 py-4 sm:items-center">
      <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-white/60 bg-[var(--app-surface-color)] shadow-telegram backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/70 px-5 py-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-[var(--app-accent-color)]">
              Pembayaran Tagihan
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
              {bill.supplierName}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">
              {bill.projectName}
            </p>
          </div>

          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-[var(--app-text-color)] transition hover:bg-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="space-y-5 px-5 py-5" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Total Bill
              </p>
              <p className="mt-1 text-base font-semibold text-[var(--app-text-color)]">
                {formatCurrency(bill.amount)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Sudah Dibayar
              </p>
              <p className="mt-1 text-base font-semibold text-[var(--app-text-color)]">
                {formatCurrency(bill.paidAmount)}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-amber-700">
                Sisa Tagihan
              </p>
              <p className="mt-1 text-base font-semibold text-amber-800">
                {formatCurrency(bill.remainingAmount)}
              </p>
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Nominal Pembayaran
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              inputMode="decimal"
              max={bill.remainingAmount}
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
              Tanggal Pembayaran
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              name="paymentDate"
              onChange={handleChange}
              required
              type="date"
              value={formData.paymentDate}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Catatan
            </span>
            <textarea
              className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              name="notes"
              onChange={handleChange}
              placeholder="Contoh: Transfer tahap pertama."
              value={formData.notes}
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="inline-flex items-center justify-center rounded-[22px] border border-slate-200 bg-white/85 px-5 py-4 text-base font-semibold text-[var(--app-text-color)] transition hover:bg-white"
              onClick={onClose}
              type="button"
            >
              Batal
            </button>

            <button
              className="inline-flex items-center justify-center rounded-[22px] bg-slate-950 px-5 py-4 text-base font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PaymentModal
