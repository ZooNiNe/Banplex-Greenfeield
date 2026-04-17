import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FormLayout from '../components/layouts/FormLayout'
import useAuthStore from '../store/useAuthStore'
import useBillStore from '../store/useBillStore'
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

function PaymentPage() {
  const navigate = useNavigate()
  const { id: billId } = useParams()
  const authUser = useAuthStore((state) => state.user)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const fetchBillById = useBillStore((state) => state.fetchBillById)
  const [bill, setBill] = useState(null)
  const [isLoadingBill, setIsLoadingBill] = useState(true)
  const [formData, setFormData] = useState(() => createInitialForm(null))
  const submitBillPayment = usePaymentStore((state) => state.submitBillPayment)
  const isSubmitting = usePaymentStore((state) => state.isSubmitting)
  const error = usePaymentStore((state) => state.error)
  const clearError = usePaymentStore((state) => state.clearError)

  useEffect(() => {
    let isActive = true

    async function loadBill() {
      setIsLoadingBill(true)

      try {
        const nextBill = await fetchBillById(billId)

        if (!isActive) {
          return
        }

        setBill(nextBill)
        setFormData(createInitialForm(nextBill))
      } catch (loadError) {
        console.error('Gagal memuat detail tagihan:', loadError)

        if (!isActive) {
          return
        }

        setBill(null)
      } finally {
        if (isActive) {
          setIsLoadingBill(false)
        }
      }
    }

    void loadBill()

    return () => {
      isActive = false
    }
  }, [billId, fetchBillById])

  useEffect(() => () => clearError(), [clearError])

  const handleBack = () => {
    navigate(-1)
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

    if (!bill || isSubmitting) {
      return
    }

    try {
      await submitBillPayment({
        bill_id: bill.id,
        telegram_user_id: authUser?.telegram_user_id ?? null,
        team_id: currentTeamId ?? bill.teamId,
        amount: formData.amount,
        maxAmount: bill.remainingAmount,
        payment_date: formData.paymentDate,
        notes: formData.notes,
        supplierName: bill.supplierName,
        projectName: bill.projectName,
        remainingAmount: Math.max(
          Number(bill.remainingAmount ?? 0) - Number(formData.amount ?? 0),
          0
        ),
      })

      navigate(-1)
    } catch (submitError) {
      console.error('Gagal menyimpan pembayaran:', submitError)
    }
  }

  return (
    <FormLayout
      actionLabel="Simpan Pembayaran"
      isSubmitting={isSubmitting}
      onBack={handleBack}
      onSubmit={handleSubmit}
      submitDisabled={!bill || isLoadingBill}
      title="Pembayaran Tagihan"
    >
      {isLoadingBill ? (
        <div className="app-section-surface border-dashed px-4 py-5 text-sm text-[var(--app-hint-color)]">
          Memuat tagihan...
        </div>
      ) : bill ? (
        <div className="space-y-4">
          <section className="app-section-surface p-4">
            <div className="flex flex-col gap-3">
              <div className="min-w-0">
                <p className="app-kicker">
                  {bill.billType || 'Salary Bill'}
                </p>
                <h2 className="app-title">
                  {bill.supplierName}
                </h2>
                <p className="app-copy">{bill.projectName}</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--app-hint-color)]">
                    Total
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--app-text-color)]">
                    {formatCurrency(bill.amount)}
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--app-hint-color)]">
                    Terbayar
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--app-text-color)]">
                    {formatCurrency(bill.paidAmount)}
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-amber-700">
                    Sisa
                  </p>
                  <p className="mt-1 text-sm font-semibold text-amber-800">
                    {formatCurrency(bill.remainingAmount)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-900">
              Nominal Pembayaran
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              inputMode="decimal"
              max={bill.remainingAmount}
              min="0.01"
              name="amount"
              onChange={handleChange}
              required
              step="0.01"
              type="number"
              value={formData.amount}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-900">
              Tanggal Pembayaran
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              name="paymentDate"
              onChange={handleChange}
              required
              type="date"
              value={formData.paymentDate}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-900">Catatan</span>
            <textarea
              className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              name="notes"
              onChange={handleChange}
              value={formData.notes}
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>
      ) : (
          <div className="app-section-surface border-dashed px-4 py-5 text-sm text-[var(--app-hint-color)]">
          Tagihan tidak ditemukan.
        </div>
      )}
    </FormLayout>
  )
}

export default PaymentPage
