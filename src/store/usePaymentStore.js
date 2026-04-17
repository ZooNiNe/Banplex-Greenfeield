import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { resolveTeamId, resolveTelegramUserId } from '../lib/auth-context'
import useBillStore from './useBillStore'

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toError(error) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : 'Gagal menyimpan pembayaran tagihan. Silakan coba lagi.'

  return error instanceof Error ? error : new Error(message)
}

function notifyTelegram(payload) {
  void fetch('/api/notify', {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.error('Gagal memanggil endpoint notifikasi pembayaran:', error)
  })
}

function buildBillPaymentPayload(paymentData = {}) {
  const billId = normalizeText(paymentData.bill_id ?? paymentData.billId)
  const telegramUserId = resolveTelegramUserId(
    paymentData.telegram_user_id ?? paymentData.telegramUserId
  )
  const teamId = resolveTeamId(paymentData.team_id ?? paymentData.teamId)
  const paymentDate = normalizeText(
    paymentData.payment_date ?? paymentData.paymentDate
  )
  const notes = normalizeText(paymentData.notes)
  const amount = Number(paymentData.amount)
  const maxAmount = Number(paymentData.maxAmount ?? paymentData.remainingAmountBeforePayment)

  if (!billId) {
    throw new Error('Bill ID tidak valid.')
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Nominal pembayaran harus lebih dari 0.')
  }

  if (!teamId) {
    throw new Error('Akses workspace tidak ditemukan.')
  }

  if (Number.isFinite(maxAmount) && amount > maxAmount) {
    throw new Error('Nominal pembayaran melebihi sisa tagihan.')
  }

  if (!paymentDate) {
    throw new Error('Tanggal pembayaran wajib diisi.')
  }

  return {
    bill_id: billId,
    telegram_user_id: telegramUserId,
    team_id: teamId,
    amount,
    payment_date: paymentDate,
    notes,
    worker_name_snapshot: normalizeText(paymentData.workerName, null),
    supplier_name_snapshot: normalizeText(paymentData.supplierName, null),
    project_name_snapshot: normalizeText(paymentData.projectName, null),
    updated_at: new Date().toISOString(),
  }
}

function buildPaymentNotificationPayload(paymentData = {}) {
  return {
    notificationType: 'bill_payment',
    billId: normalizeText(paymentData.bill_id ?? paymentData.billId, '-'),
    paymentDate: normalizeText(
      paymentData.payment_date ?? paymentData.paymentDate,
      new Date().toISOString()
    ),
    userName: normalizeText(paymentData.userName, 'Pengguna Telegram'),
    supplierName: normalizeText(paymentData.supplierName, '-'),
    projectName: normalizeText(paymentData.projectName, '-'),
    amount: Number(paymentData.amount) || 0,
    remainingAmount: Number(paymentData.remainingAmount) || 0,
    description: normalizeText(
      paymentData.notes,
      'Pembayaran tagihan telah dilakukan.'
    ),
  }
}

const usePaymentStore = create((set) => ({
  isSubmitting: false,
  error: null,
  clearError: () => set({ error: null }),
  submitBillPayment: async (paymentData = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const payload = buildBillPaymentPayload(paymentData)
      const { data, error } = await supabase
        .from('bill_payments')
        .insert(payload)
        .select('id, bill_id, amount, payment_date')
        .single()

      if (error) {
        throw error
      }

      await useBillStore.getState().fetchUnpaidBills({
        teamId: payload.team_id,
        silent: true,
      })

      notifyTelegram(buildPaymentNotificationPayload(paymentData))

      set({ error: null })

      return data
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
}))

export default usePaymentStore
export { usePaymentStore }
