const allRoles = [
  'Owner',
  'Admin',
  'Logistik',
  'Payroll',
  'Administrasi',
  'Viewer',
]

function normalizeRole(role) {
  const normalizedRole = String(role ?? '').trim()

  return normalizedRole.length > 0 ? normalizedRole : null
}

function hasRequiredRole(role, allowedRoles = []) {
  const normalizedRole = normalizeRole(role)

  if (!normalizedRole) {
    return false
  }

  return allowedRoles.includes(normalizedRole)
}

export { allRoles, hasRequiredRole, normalizeRole }
