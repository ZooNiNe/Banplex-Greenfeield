import { useEffect, useMemo, useState } from 'react'
import { FileClock, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import useTelegram from '../hooks/useTelegram'
import useAuthStore from '../store/useAuthStore'
import useAttendanceStore from '../store/useAttendanceStore'

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

function getStatusLabel(status) {
  if (status === 'half_day') {
    return 'Half Day'
  }

  if (status === 'overtime') {
    return 'Lembur'
  }

  return 'Full Day'
}

function getTodayDateString() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
  }).format(new Date())
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

function groupAttendances(attendances) {
  const grouped = attendances.reduce((accumulator, attendance) => {
    const workerId = attendance.worker_id
    const workerName = attendance.worker_name ?? 'Pekerja belum terhubung'
    const groupKey = workerId ?? workerName

    if (!accumulator[groupKey]) {
      accumulator[groupKey] = {
        workerId,
        workerName,
        records: [],
        totalAmount: 0,
      }
    }

    accumulator[groupKey].records.push(attendance)
    accumulator[groupKey].totalAmount += Number(attendance.total_pay ?? 0)

    return accumulator
  }, {})

  return Object.values(grouped).sort((a, b) =>
    a.workerName.localeCompare(b.workerName, 'id', { sensitivity: 'base' })
  )
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
    console.error('Gagal memanggil endpoint notifikasi payroll:', error)
  })
}

function PayrollManager({ onSuccess }) {
  const { user } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const userDisplayName = getUserDisplayName(user, authUser)
  const unbilledAttendances = useAttendanceStore((state) => state.unbilledAttendances)
  const isLoading = useAttendanceStore((state) => state.isLoading)
  const error = useAttendanceStore((state) => state.error)
  const fetchUnbilledAttendances = useAttendanceStore(
    (state) => state.fetchUnbilledAttendances
  )
  const clearError = useAttendanceStore((state) => state.clearError)
  const [activeWorkerId, setActiveWorkerId] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const groupedAttendances = useMemo(
    () => groupAttendances(unbilledAttendances),
    [unbilledAttendances]
  )

  useEffect(() => {
    fetchUnbilledAttendances({
      teamId: currentTeamId,
      force: true,
    }).catch((fetchError) => {
      console.error('Gagal memuat absensi yang belum ditagihkan:', fetchError)
    })
  }, [currentTeamId, fetchUnbilledAttendances])

  useEffect(() => () => clearError(), [clearError])

  const handleCreateBill = async (group) => {
    if (!group?.workerId || group.records.length === 0 || !supabase) {
      return
    }

    setActiveWorkerId(group.workerId)
    setSuccessMessage(null)

    try {
      const recordIds = group.records.map((record) => record.id)
      const dueDate = getTodayDateString()
      const description = `Tagihan gaji untuk ${group.workerName} (${group.records.length} absensi)`

      const { data, error: rpcError } = await supabase.rpc('fn_generate_salary_bill', {
        p_worker_id: group.workerId,
        p_record_ids: recordIds,
        p_total_amount: group.totalAmount,
        p_due_date: dueDate,
        p_description: description,
      })

      if (rpcError) {
        throw rpcError
      }

      const newBillId = Array.isArray(data) ? data[0] : data

      notifyTelegram({
        notificationType: 'salary_bill',
        workerName: group.workerName,
        amount: group.totalAmount,
        dueDate,
        billId: newBillId ?? null,
        recordCount: group.records.length,
        userName: userDisplayName,
        description,
      })

      setSuccessMessage(
        `Tagihan gaji untuk ${group.workerName} sebesar ${formatCurrency(group.totalAmount)} telah dibuat.`
      )

      await fetchUnbilledAttendances({
        teamId: currentTeamId,
        force: true,
      })

      if (typeof onSuccess === 'function') {
        await onSuccess()
      }
    } catch (billError) {
      const message =
        billError instanceof Error
          ? billError.message
          : 'Gagal membuat tagihan gaji.'

      console.error(message)
    } finally {
      setActiveWorkerId(null)
    }
  }

  return (
    <section className="space-y-5 rounded-[28px] border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--app-accent-color)]">
          Rekap Gaji
        </p>
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
          Bundel absensi menjadi tagihan gaji
        </h2>
        <p className="text-sm leading-6 text-[var(--app-hint-color)]">
          Pilih kelompok pekerja, lalu buat satu tagihan gaji dari absensi yang
          belum ditagihkan.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {isLoading && groupedAttendances.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white/80 px-4 py-5 text-sm text-[var(--app-hint-color)]">
          Memuat absensi yang belum ditagihkan...
        </div>
      ) : groupedAttendances.length > 0 ? (
        <div className="space-y-4">
          {groupedAttendances.map((group) => {
            const isProcessing = activeWorkerId === group.workerId
            const dateValues = group.records.map((record) => record.attendance_date)
            const firstDate = dateValues[0] ?? null
            const lastDate = dateValues[dateValues.length - 1] ?? null

            return (
              <article
                key={group.workerId ?? group.workerName}
                className="rounded-[26px] border border-slate-200 bg-white/90 p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileClock className="h-4 w-4 text-sky-600" />
                      <p className="text-base font-semibold text-[var(--app-text-color)]">
                        {group.workerName}
                      </p>
                    </div>
                    <p className="text-sm text-[var(--app-hint-color)]">
                      {group.records.length} absensi belum dibundel
                    </p>
                    <p className="text-sm text-slate-500">
                      Periode {formatDate(firstDate)} - {formatDate(lastDate)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                      Total Upah
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
                      {formatCurrency(group.totalAmount)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {group.records.map((record) => (
                    <div
                      key={record.id}
                      className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-[var(--app-text-color)]">
                          {formatDate(record.attendance_date)} -{' '}
                          {record.project_name ?? 'Proyek belum terhubung'}
                        </p>
                        <p className="text-sm text-[var(--app-hint-color)]">
                          {getStatusLabel(record.attendance_status)}
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-slate-700">
                        {formatCurrency(record.total_pay)}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-[20px] bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isProcessing}
                  onClick={() => handleCreateBill(group)}
                  type="button"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Membuat Tagihan...
                    </>
                  ) : (
                    'Buat Tagihan Gaji'
                  )}
                </button>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm leading-6 text-[var(--app-hint-color)]">
          Belum ada absensi yang belum ditagihkan.
        </div>
      )}
    </section>
  )
}

export default PayrollManager
