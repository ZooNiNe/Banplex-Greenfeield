import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { resolveTeamId, resolveTelegramUserId } from '../lib/auth-context'

const attendanceSelectColumns =
  'id, telegram_user_id, team_id, worker_id, project_id, attendance_date, attendance_status, total_pay, entry_mode, billing_status, salary_bill_id, notes, worker_name_snapshot, project_name_snapshot, created_at, updated_at, workers:worker_id ( id, name ), projects:project_id ( id, name )'

const ATTENDANCE_STATUS_OPTIONS = [
  { value: 'full_day', label: 'Full Day', multiplier: 1 },
  { value: 'half_day', label: 'Half Day', multiplier: 0.5 },
  { value: 'overtime', label: 'Lembur', multiplier: 1.5 },
]

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function toError(error, fallbackMessage) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : fallbackMessage

  return error instanceof Error ? error : new Error(message)
}

function getAttendanceMultiplier(status) {
  return (
    ATTENDANCE_STATUS_OPTIONS.find((option) => option.value === status)?.multiplier ?? 0
  )
}

function getAttendanceStatusLabel(status) {
  return (
    ATTENDANCE_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'Belum Diisi'
  )
}

function normalizeAttendanceRow(attendance) {
  const worker = Array.isArray(attendance?.workers)
    ? attendance.workers[0] ?? null
    : attendance?.workers ?? null
  const project = Array.isArray(attendance?.projects)
    ? attendance.projects[0] ?? null
    : attendance?.projects ?? null

  return {
    ...attendance,
    total_pay: toNumber(attendance?.total_pay),
    worker_name: normalizeText(
      worker?.name ?? attendance?.worker_name_snapshot,
      'Pekerja belum terhubung'
    ),
    project_name: normalizeText(
      project?.name ?? attendance?.project_name_snapshot,
      'Proyek belum terhubung'
    ),
    attendance_status: normalizeText(attendance?.attendance_status, 'full_day'),
    billing_status: normalizeText(attendance?.billing_status, 'unbilled'),
    entry_mode: normalizeText(attendance?.entry_mode, 'manual'),
  }
}

async function loadAttendanceEntries({ teamId, date, projectId }) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedTeamId = resolveTeamId(teamId)
  const normalizedDate = normalizeText(date)
  const normalizedProjectId = normalizeText(projectId)

  if (!normalizedTeamId) {
    throw new Error('Akses workspace tidak ditemukan.')
  }

  if (!normalizedDate) {
    throw new Error('Tanggal absensi wajib dipilih.')
  }

  if (!normalizedProjectId) {
    throw new Error('Proyek absensi wajib dipilih.')
  }

  const { data, error } = await supabase
    .from('attendance_records')
    .select(attendanceSelectColumns)
    .eq('team_id', normalizedTeamId)
    .eq('attendance_date', normalizedDate)
    .eq('project_id', normalizedProjectId)
    .is('deleted_at', null)
    .order('worker_name_snapshot', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map(normalizeAttendanceRow)
}

async function loadUnbilledAttendances(teamId = null) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  let query = supabase
    .from('attendance_records')
    .select(attendanceSelectColumns)
    .is('deleted_at', null)
    .eq('billing_status', 'unbilled')
    .order('attendance_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (teamId) {
    query = query.eq('team_id', teamId)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []).map(normalizeAttendanceRow)
}

async function persistAttendanceSheet({
  teamId,
  telegramUserId,
  attendanceDate,
  projectId,
  rows,
}) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedTeamId = resolveTeamId(teamId)
  const normalizedTelegramUserId = resolveTelegramUserId(telegramUserId)
  const normalizedDate = normalizeText(attendanceDate)
  const normalizedProjectId = normalizeText(projectId)
  const normalizedRows = Array.isArray(rows) ? rows : []

  if (!normalizedTeamId) {
    throw new Error('Akses workspace tidak ditemukan.')
  }

  if (!normalizedTelegramUserId) {
    throw new Error('ID pengguna Telegram tidak ditemukan.')
  }

  if (!normalizedDate) {
    throw new Error('Tanggal absensi wajib dipilih.')
  }

  if (!normalizedProjectId) {
    throw new Error('Proyek absensi wajib dipilih.')
  }

  const rowsToPersist = normalizedRows
    .map((row) => ({
      sourceId: normalizeText(row?.sourceId ?? row?.id, null),
      worker_id: normalizeText(row?.worker_id ?? row?.workerId),
      worker_name: normalizeText(row?.worker_name ?? row?.workerName, null),
      project_id: normalizedProjectId,
      project_name: normalizeText(row?.project_name ?? row?.projectName, null),
      attendance_status: normalizeText(
        row?.attendance_status ?? row?.attendanceStatus,
        null
      ),
      total_pay: toNumber(row?.total_pay ?? row?.totalPay),
      notes: normalizeText(row?.notes, null),
    }))
    .filter((row) => row.worker_id || row.sourceId)

  const deletes = rowsToPersist.filter((row) => row.sourceId && !row.attendance_status)
  const saves = rowsToPersist.filter((row) => row.attendance_status)
  const updates = saves.filter((row) => row.sourceId)
  const inserts = saves.filter((row) => !row.sourceId)
  const timestamp = new Date().toISOString()

  await Promise.all(
    deletes.map(async (row) => {
      const { error } = await supabase
        .from('attendance_records')
        .update({
          deleted_at: timestamp,
          updated_at: timestamp,
        })
        .eq('id', row.sourceId)
        .is('deleted_at', null)

      if (error) {
        throw error
      }
    })
  )

  await Promise.all(
    updates.map(async (row) => {
      const { error } = await supabase
        .from('attendance_records')
        .update({
          telegram_user_id: normalizedTelegramUserId,
          team_id: normalizedTeamId,
          worker_id: row.worker_id,
          project_id: normalizedProjectId,
          worker_name_snapshot: row.worker_name,
          project_name_snapshot: row.project_name,
          attendance_date: normalizedDate,
          attendance_status: row.attendance_status,
          total_pay: row.total_pay,
          entry_mode: 'manual',
          billing_status: 'unbilled',
          notes: row.notes,
          updated_at: timestamp,
          deleted_at: null,
        })
        .eq('id', row.sourceId)
        .select(attendanceSelectColumns)
        .single()

      if (error) {
        throw error
      }
    })
  )

  if (inserts.length > 0) {
    const { error } = await supabase.from('attendance_records').insert(
      inserts.map((row) => ({
        telegram_user_id: normalizedTelegramUserId,
        team_id: normalizedTeamId,
        worker_id: row.worker_id,
        project_id: normalizedProjectId,
        worker_name_snapshot: row.worker_name,
        project_name_snapshot: row.project_name,
        attendance_date: normalizedDate,
        attendance_status: row.attendance_status,
        total_pay: row.total_pay,
        entry_mode: 'manual',
        billing_status: 'unbilled',
        notes: row.notes,
        updated_at: timestamp,
      }))
    )

    if (error) {
      throw error
    }
  }

  return loadAttendanceEntries({
    teamId: normalizedTeamId,
    date: normalizedDate,
    projectId: normalizedProjectId,
  })
}

const useAttendanceStore = create((set, get) => ({
  unbilledAttendances: [],
  sheetAttendances: [],
  isLoading: false,
  isSubmitting: false,
  isSheetLoading: false,
  isSheetSaving: false,
  error: null,
  lastUpdatedAt: null,
  attendanceStatusOptions: ATTENDANCE_STATUS_OPTIONS,
  clearError: () => set({ error: null }),
  fetchUnbilledAttendances: async ({ teamId = null, force = false } = {}) => {
    const currentState = get()

    if (!force && !currentState.isLoading && currentState.unbilledAttendances.length > 0) {
      return currentState.unbilledAttendances
    }

    set({
      isLoading: true,
      error: null,
    })

    try {
      const nextAttendances = await loadUnbilledAttendances(resolveTeamId(teamId))

      set({
        unbilledAttendances: nextAttendances,
        isLoading: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      })

      return nextAttendances
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat absensi yang belum ditagihkan.')

      set({
        unbilledAttendances: [],
        isLoading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  fetchAttendanceSheet: async ({
    teamId,
    date,
    projectId,
    persist = true,
  } = {}) => {
    if (persist) {
      set({
        isSheetLoading: true,
        error: null,
      })
    }

    try {
      const rows = await loadAttendanceEntries({
        teamId,
        date,
        projectId,
      })

      if (persist) {
        set({
          sheetAttendances: rows,
          isSheetLoading: false,
          error: null,
          lastUpdatedAt: new Date().toISOString(),
        })
      }

      return rows
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat absensi harian.')

      if (persist) {
        set({
          sheetAttendances: [],
          isSheetLoading: false,
          error: normalizedError.message,
        })
      }

      throw normalizedError
    }
  },
  saveAttendanceSheet: async ({
    teamId,
    telegramUserId,
    attendanceDate,
    projectId,
    rows,
  } = {}) => {
    set({
      isSheetSaving: true,
      error: null,
    })

    try {
      const nextRows = await persistAttendanceSheet({
        teamId,
        telegramUserId,
        attendanceDate,
        projectId,
        rows,
      })

      set({
        sheetAttendances: nextRows,
        isSheetSaving: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      })

      return nextRows
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menyimpan absensi harian.')

      set({
        isSheetSaving: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  submitAttendance: async (data = {}) => {
    set({
      isSubmitting: true,
      error: null,
    })

    try {
      const nextRows = await persistAttendanceSheet({
        teamId: data.team_id,
        telegramUserId: data.telegram_user_id,
        attendanceDate: data.attendance_date ?? data.date ?? data.attendanceDate,
        projectId: data.project_id,
        rows: [
          {
            worker_id: data.worker_id,
            worker_name: data.worker_name,
            project_name: data.project_name,
            attendance_status: data.attendance_status ?? data.attendanceStatus,
            total_pay: data.total_pay ?? data.totalPay,
            notes: data.notes,
          },
        ],
      })

      set({
        isSubmitting: false,
        sheetAttendances: nextRows,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      })

      return nextRows[0] ?? null
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menyimpan absensi.')

      set({
        isSubmitting: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  attendanceStatusLabel: getAttendanceStatusLabel,
  attendanceStatusMultiplier: getAttendanceMultiplier,
}))

export default useAttendanceStore
export { ATTENDANCE_STATUS_OPTIONS, useAttendanceStore }
