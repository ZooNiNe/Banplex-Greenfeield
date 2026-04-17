import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import { createClient } from '@supabase/supabase-js'

const MAX_INIT_DATA_AGE_SECONDS = 60 * 60 * 24
const validRoles = new Set([
  'Owner',
  'Admin',
  'Logistik',
  'Payroll',
  'Administrasi',
  'Viewer',
])

function getEnv(name, fallback = '') {
  return String(globalThis.process?.env?.[name] ?? fallback).trim()
}

function createHttpError(status, message) {
  const error = new Error(message)

  error.statusCode = status

  return error
}

async function parseRequestBody(req) {
  if (typeof req.body === 'string' && req.body.trim().length > 0) {
    return JSON.parse(req.body)
  }

  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  const chunks = []

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString())
  }

  const rawBody = chunks.join('').trim()

  return rawBody ? JSON.parse(rawBody) : {}
}

function buildTelegramSecretKey(botToken) {
  return crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
}

function normalizeTelegramIdentifier(value) {
  return String(value ?? '').trim()
}

function verifyInitData(initData, botToken) {
  const normalizedInitData = String(initData ?? '').trim()

  if (!normalizedInitData) {
    throw createHttpError(400, 'initData Telegram wajib dikirim.')
  }

  const params = new URLSearchParams(normalizedInitData)
  const receivedHash = params.get('hash')

  if (!receivedHash) {
    throw createHttpError(401, 'Hash Telegram tidak ditemukan.')
  }

  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const calculatedHash = crypto
    .createHmac('sha256', buildTelegramSecretKey(botToken))
    .update(dataCheckString)
    .digest('hex')

  const calculatedHashBuffer = Buffer.from(calculatedHash, 'hex')
  const receivedHashBuffer = Buffer.from(receivedHash, 'hex')

  if (
    calculatedHashBuffer.length !== receivedHashBuffer.length ||
    !crypto.timingSafeEqual(calculatedHashBuffer, receivedHashBuffer)
  ) {
    throw createHttpError(401, 'initData Telegram tidak valid.')
  }

  const authDate = Number(params.get('auth_date'))

  if (!Number.isFinite(authDate)) {
    throw createHttpError(401, 'auth_date Telegram tidak valid.')
  }

  const ageInSeconds = Math.floor(Date.now() / 1000) - authDate

  if (ageInSeconds > MAX_INIT_DATA_AGE_SECONDS) {
    throw createHttpError(401, 'initData Telegram sudah kedaluwarsa.')
  }

  const rawUser = params.get('user')

  if (!rawUser) {
    throw createHttpError(401, 'Data user Telegram tidak ditemukan.')
  }

  let telegramUser

  try {
    telegramUser = JSON.parse(rawUser)
  } catch {
    throw createHttpError(401, 'Payload user Telegram tidak valid.')
  }

  const telegramUserId = normalizeTelegramIdentifier(telegramUser?.id)

  if (!telegramUserId) {
    throw createHttpError(401, 'telegram_user_id tidak ditemukan.')
  }

  return {
    telegramUserId,
    telegramUser,
  }
}

function getTelegramLoginEmail(telegramUserId) {
  return `telegram-${telegramUserId}@banplex.local`
}

function buildTelegramPassword(telegramUserId, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`banplex-telegram-auth:${telegramUserId}`)
    .digest('hex')
}

function createAdminClient(url, serviceRoleKey) {
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function createPublicClient(url, publishableKey) {
  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

async function signInOrCreateTelegramUser({
  adminClient,
  publicClient,
  email,
  password,
  telegramUser,
}) {
  const firstSignIn = await publicClient.auth.signInWithPassword({
    email,
    password,
  })

  if (firstSignIn.data?.session && firstSignIn.data?.user) {
    return firstSignIn
  }

  const createResult = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: telegramUser?.first_name ?? null,
      last_name: telegramUser?.last_name ?? null,
      username: telegramUser?.username ?? null,
      telegram_user_id: String(telegramUser?.id ?? ''),
    },
    app_metadata: {
      provider: 'telegram',
      providers: ['telegram'],
    },
  })

  if (
    createResult.error &&
    !String(createResult.error.message ?? '')
      .toLowerCase()
      .includes('already')
  ) {
    throw createResult.error
  }

  const secondSignIn = await publicClient.auth.signInWithPassword({
    email,
    password,
  })

  if (!secondSignIn.data?.session || !secondSignIn.data?.user) {
    throw secondSignIn.error ?? createHttpError(500, 'Gagal membuat session Supabase.')
  }

  return secondSignIn
}

async function ensureProfile(adminClient, authUserId, telegramUserId) {
  const { data: existingProfiles, error: existingProfilesError } = await adminClient
    .from('profiles')
    .select('id, telegram_user_id, role, created_at')
    .eq('telegram_user_id', telegramUserId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (existingProfilesError) {
    throw existingProfilesError
  }

  const existingProfile = existingProfiles?.[0] ?? null
  const profileRole = validRoles.has(String(existingProfile?.role ?? '').trim())
    ? String(existingProfile.role).trim()
    : 'Viewer'

  if (!existingProfile) {
    const insertResult = await adminClient
      .from('profiles')
      .insert({
        id: authUserId,
        telegram_user_id: telegramUserId,
        role: 'Viewer',
      })
      .select('id, telegram_user_id, role, created_at')
      .single()

    if (insertResult.error) {
      throw insertResult.error
    }

    return {
      profile: insertResult.data,
      hadExistingProfile: false,
    }
  }

  if (existingProfile.id !== authUserId) {
    const updateResult = await adminClient
      .from('profiles')
      .update({
        id: authUserId,
        telegram_user_id: telegramUserId,
        role: profileRole,
      })
      .eq('id', existingProfile.id)
      .select('id, telegram_user_id, role, created_at')
      .single()

    if (updateResult.error) {
      throw updateResult.error
    }

    return {
      profile: updateResult.data,
      hadExistingProfile: true,
    }
  }

  return {
      profile: {
      ...existingProfile,
      role: profileRole,
    },
    hadExistingProfile: true,
  }
}

async function ensureProfileRole(
  adminClient,
  authUserId,
  telegramUserId,
  enforcedRole = null
) {
  const { profile } = await ensureProfile(adminClient, authUserId, telegramUserId)
  const normalizedEnforcedRole = validRoles.has(String(enforcedRole ?? '').trim())
    ? String(enforcedRole).trim()
    : null

  if (!normalizedEnforcedRole || profile?.role === normalizedEnforcedRole) {
    return profile
  }

  const updateResult = await adminClient
    .from('profiles')
    .update({
      role: normalizedEnforcedRole,
    })
    .eq('id', authUserId)
    .select('id, telegram_user_id, role, created_at')
    .single()

  if (updateResult.error) {
    throw updateResult.error
  }

  return updateResult.data
}

async function fetchMemberships(adminClient, telegramUserId) {
  const { data: memberships, error: membershipsError } = await adminClient
    .from('team_members')
    .select('id, team_id, telegram_user_id, role, is_default, status, approved_at')
    .eq('telegram_user_id', telegramUserId)
    .limit(5)

  if (membershipsError) {
    throw membershipsError
  }

  return memberships ?? []
}

async function resolveOwnerTeamId(adminClient) {
  const defaultTeamResult = await adminClient
    .from('teams')
    .select('id')
    .eq('slug', 'default-workspace')
    .eq('is_active', true)
    .maybeSingle()

  if (defaultTeamResult.error) {
    throw defaultTeamResult.error
  }

  if (defaultTeamResult.data?.id) {
    return defaultTeamResult.data.id
  }

  const fallbackTeamResult = await adminClient
    .from('teams')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (fallbackTeamResult.error) {
    throw fallbackTeamResult.error
  }

  return fallbackTeamResult.data?.id ?? null
}

async function ensureOwnerMembership(adminClient, telegramUserId) {
  const normalizedTelegramUserId = normalizeTelegramIdentifier(telegramUserId)
  const approvalTimestamp = new Date().toISOString()
  const existingMemberships = await fetchMemberships(
    adminClient,
    normalizedTelegramUserId
  )

  if (existingMemberships.length > 0) {
    const updateResult = await adminClient
      .from('team_members')
      .update({
        role: 'Owner',
        status: 'active',
        approved_at: approvalTimestamp,
      })
      .eq('telegram_user_id', normalizedTelegramUserId)
      .select('id, team_id, telegram_user_id, role, is_default, status, approved_at')

    if (updateResult.error) {
      throw updateResult.error
    }

    return updateResult.data ?? []
  }

  const ownerTeamId = await resolveOwnerTeamId(adminClient)

  if (!ownerTeamId) {
    throw createHttpError(500, 'Workspace aktif untuk Owner tidak ditemukan.')
  }

  const insertResult = await adminClient
    .from('team_members')
    .insert({
      team_id: ownerTeamId,
      telegram_user_id: normalizedTelegramUserId,
      role: 'Owner',
      is_default: true,
      status: 'active',
      approved_at: approvalTimestamp,
    })
    .select('id, team_id, telegram_user_id, role, is_default, status, approved_at')
    .single()

  if (insertResult.error) {
    throw insertResult.error
  }

  return [insertResult.data]
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed.',
    })
  }

  const supabaseUrl = getEnv('SUPABASE_URL', getEnv('VITE_SUPABASE_URL'))
  const serviceRoleKey = getEnv(
    'SUPABASE_SERVICE_ROLE_KEY',
    getEnv('VITE_SUPABASE_ANON_KEY')
  )
  const publishableKey = getEnv(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    getEnv('VITE_SUPABASE_ANON_KEY')
  )
  const telegramBotToken = getEnv('TELEGRAM_BOT_TOKEN')
  const appAuthSecret = getEnv('APP_AUTH_SECRET', telegramBotToken)
  const ownerTelegramId = getEnv('OWNER_TELEGRAM_ID')

  if (!supabaseUrl || !serviceRoleKey || !publishableKey || !telegramBotToken) {
    return res.status(500).json({
      success: false,
      error: 'Environment auth belum lengkap.',
    })
  }

  try {
    const body = await parseRequestBody(req)
    const { initData } = body
    const { telegramUserId, telegramUser } = verifyInitData(initData, telegramBotToken)
    const normalizedTelegramUserId = normalizeTelegramIdentifier(telegramUserId)
    const normalizedOwnerTelegramId = normalizeTelegramIdentifier(ownerTelegramId)
    const isOwnerBypass =
      normalizedOwnerTelegramId.length > 0 &&
      String(normalizedTelegramUserId) === String(normalizedOwnerTelegramId)
    const email = getTelegramLoginEmail(telegramUserId)
    const password = buildTelegramPassword(telegramUserId, appAuthSecret)
    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey)
    const publicClient = createPublicClient(supabaseUrl, publishableKey)
    const signInResult = await signInOrCreateTelegramUser({
      adminClient,
      publicClient,
      email,
      password,
      telegramUser,
    })
    const authUser = signInResult.data.user
    const session = signInResult.data.session

    if (!authUser?.id || !session?.access_token || !session?.refresh_token) {
      throw createHttpError(500, 'Session Supabase tidak lengkap.')
    }

    const profile = await ensureProfileRole(
      adminClient,
      authUser.id,
      normalizedTelegramUserId,
      isOwnerBypass ? 'Owner' : null
    )
    const memberships = isOwnerBypass
      ? await ensureOwnerMembership(adminClient, normalizedTelegramUserId)
      : await fetchMemberships(adminClient, normalizedTelegramUserId)
    const effectiveRole = isOwnerBypass
      ? 'Owner'
      : String(memberships?.[0]?.role ?? profile?.role ?? 'Viewer').trim()
    const responseProfile = isOwnerBypass
      ? {
          ...profile,
          role: 'Owner',
        }
      : profile

    return res.status(200).json({
      success: true,
      profile: responseProfile,
      memberships,
      role: effectiveRole,
      isOwnerBypass,
      telegramUser: {
        id: normalizedTelegramUserId,
        first_name: telegramUser?.first_name ?? null,
        last_name: telegramUser?.last_name ?? null,
        username: telegramUser?.username ?? null,
      },
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at ?? null,
        expires_in: session.expires_in ?? null,
        token_type: session.token_type ?? 'bearer',
      },
    })
  } catch (error) {
    const statusCode =
      typeof error?.statusCode === 'number' ? error.statusCode : 500

    return res.status(statusCode).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat memverifikasi Telegram auth.',
    })
  }
}
