import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { resolveProfileId, resolveTeamId } from '../lib/auth-context'
import { normalizeRole } from '../lib/rbac'

const inviteRoleOptions = [
  'Admin',
  'Logistik',
  'Payroll',
  'Administrasi',
  'Viewer',
]

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toError(error, fallbackMessage) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : fallbackMessage

  return error instanceof Error ? error : new Error(message)
}

function randomTokenSegment(length = 10) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const cryptoApi =
    typeof globalThis !== 'undefined' ? globalThis.crypto ?? null : null

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(length)
    cryptoApi.getRandomValues(bytes)

    return [...bytes]
      .map((value) => alphabet[value % alphabet.length])
      .join('')
  }

  return Array.from({ length }, () => {
    const index = Math.floor(Math.random() * alphabet.length)
    return alphabet[index]
  }).join('')
}

function getBotUsername() {
  return (
    normalizeText(import.meta.env.VITE_TELEGRAM_BOT_USERNAME, null) ?? 'NamaBotAnda'
  )
}

function buildInviteLink(token) {
  return `https://t.me/${getBotUsername()}/app?startapp=${encodeURIComponent(token)}`
}

function mapTeamMember(member) {
  return {
    id: member?.id ?? null,
    team_id: normalizeText(member?.team_id, null),
    telegram_user_id: normalizeText(member?.telegram_user_id, null),
    role: normalizeRole(member?.role),
    status: normalizeText(member?.status, 'active'),
    approved_at: normalizeText(member?.approved_at, null),
    is_default: Boolean(member?.is_default),
  }
}

async function loadActiveTeam(teamId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  if (!teamId) {
    return []
  }

  const { data, error } = await supabase
    .from('team_members')
    .select('id, team_id, telegram_user_id, role, status, approved_at, is_default')
    .eq('team_id', teamId)
    .eq('status', 'active')
    .order('is_default', { ascending: false })
    .order('approved_at', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map(mapTeamMember)
}

const useTeamStore = create((set) => ({
  activeTeam: [],
  latestInvite: null,
  isLoading: false,
  error: null,
  clearError: () => set({ error: null }),
  fetchActiveTeam: async () => {
    set({ isLoading: true, error: null })

    try {
      const teamId = resolveTeamId()
      const activeTeam = await loadActiveTeam(teamId)

      set({
        activeTeam,
        isLoading: false,
        error: null,
      })

      return activeTeam
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat tim aktif.')

      set({
        activeTeam: [],
        isLoading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  generateInviteLink: async (role) => {
    set({ isLoading: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const normalizedRole = normalizeRole(role)
      const teamId = resolveTeamId()
      const createdBy = resolveProfileId()

      if (!inviteRoleOptions.includes(normalizedRole)) {
        throw new Error('Role undangan tidak valid.')
      }

      if (!teamId || !createdBy) {
        throw new Error('Konteks Owner atau team aktif belum tersedia.')
      }

      const token = `inv_${randomTokenSegment(10)}`
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      const { data, error } = await supabase
        .from('invite_tokens')
        .insert({
          team_id: teamId,
          token,
          role: normalizedRole,
          expires_at: expiresAt,
          created_by: createdBy,
        })
        .select('id, token, role, expires_at, team_id, is_used, created_at')
        .single()

      if (error) {
        throw error
      }

      const nextInvite = {
        ...data,
        invite_link: buildInviteLink(token),
      }

      set({
        latestInvite: nextInvite,
        isLoading: false,
        error: null,
      })

      return nextInvite
    } catch (error) {
      const normalizedError = toError(error, 'Gagal membuat link undangan.')

      set({
        isLoading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  updateTeamMemberRole: async (memberId, role) => {
    set({ isLoading: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const normalizedRole = normalizeRole(role)
      const teamId = resolveTeamId()

      if (!inviteRoleOptions.includes(normalizedRole)) {
        throw new Error('Role karyawan tidak valid.')
      }

      const { data, error } = await supabase
        .from('team_members')
        .update({
          role: normalizedRole,
        })
        .eq('id', memberId)
        .eq('team_id', teamId)
        .eq('status', 'active')
        .select('id, team_id, telegram_user_id, role, status, approved_at, is_default')
        .single()

      if (error) {
        throw error
      }

      const nextMember = mapTeamMember(data)

      set((state) => ({
        activeTeam: state.activeTeam.map((member) =>
          member.id === memberId ? nextMember : member
        ),
        isLoading: false,
        error: null,
      }))

      return nextMember
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memperbarui role anggota.')

      set({
        isLoading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  suspendTeamMember: async (memberId) => {
    set({ isLoading: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const teamId = resolveTeamId()

      const { error } = await supabase
        .from('team_members')
        .update({
          status: 'suspended',
        })
        .eq('id', memberId)
        .eq('team_id', teamId)
        .eq('status', 'active')

      if (error) {
        throw error
      }

      set((state) => ({
        activeTeam: state.activeTeam.filter((member) => member.id !== memberId),
        isLoading: false,
        error: null,
      }))

      return true
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menangguhkan anggota tim.')

      set({
        isLoading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
}))

export { inviteRoleOptions, useTeamStore }
export default useTeamStore
