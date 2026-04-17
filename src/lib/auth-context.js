import useAuthStore from '../store/useAuthStore'

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function getAuthContext() {
  const state = useAuthStore.getState()
  const user = state.user ?? null

  return {
    user,
    profileId: normalizeText(user?.id, null),
    telegramUserId: normalizeText(user?.telegram_user_id, null),
    currentTeamId: normalizeText(state.currentTeamId, null),
    role: normalizeText(state.role, null),
  }
}

function resolveTelegramUserId(explicitTelegramUserId = null) {
  return normalizeText(explicitTelegramUserId, null) ?? getAuthContext().telegramUserId
}

function resolveTeamId(explicitTeamId = null) {
  return normalizeText(explicitTeamId, null) ?? getAuthContext().currentTeamId
}

function resolveProfileId(explicitProfileId = null) {
  return normalizeText(explicitProfileId, null) ?? getAuthContext().profileId
}

export { getAuthContext, resolveProfileId, resolveTelegramUserId, resolveTeamId }
