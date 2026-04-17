import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, X } from 'lucide-react'
import useAuthStore from '../../store/useAuthStore'
import { hasRequiredRole, normalizeRole } from '../../lib/rbac'

function isActionVisible(action, userRole) {
  if (!action || action.hidden) {
    return false
  }

  const requiredRole = action.requireRole ?? action.allowedRole ?? null

  if (!requiredRole) {
    return true
  }

  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
  const currentRole = normalizeRole(userRole)

  if (allowedRoles.length === 1 && allowedRoles[0] === 'Owner') {
    return currentRole === 'Owner'
  }

  return hasRequiredRole(currentRole, allowedRoles)
}

function ActionButton({
  action,
  onClick,
}) {
  const isDanger = action.variant === 'danger' || action.destructive

  return (
    <button
      className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition ${
        isDanger
          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
          : 'border-slate-200 bg-white text-[var(--app-text-color)] hover:bg-slate-50'
      }`}
      disabled={action.disabled}
      onClick={() => onClick(action)}
      type="button"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {action.icon ? <span className="shrink-0">{action.icon}</span> : null}
        <span className="truncate font-medium">{action.label}</span>
      </span>
      {action.meta ? (
        <span className="shrink-0 text-xs text-slate-500">{action.meta}</span>
      ) : null}
    </button>
  )
}

function ActionCard({
  title,
  subtitle,
  amount = null,
  amountClassName = '',
  badge = null,
  badgeClassName = '',
  actions = [],
  className = '',
  leadingIcon = null,
  titleClassName = '',
}) {
  const role = useAuthStore((state) => state.role)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const visibleActions = useMemo(() => {
    return actions.filter((action) => isActionVisible(action, role))
  }, [actions, role])

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  const handleActionClick = (action) => {
    setIsMenuOpen(false)

    if (typeof action.onClick === 'function') {
      action.onClick(action)
    }
  }

  const sheet =
    isMenuOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 px-2 py-2 sm:items-center"
            onClick={() => setIsMenuOpen(false)}
            role="presentation"
          >
          <div
            className="w-full max-w-md overflow-hidden rounded-t-[24px] border border-white/70 bg-[var(--app-surface-color)] shadow-telegram backdrop-blur-xl sm:rounded-[24px]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Menu aksi untuk ${title}`}
          >
              <div className="flex items-center justify-between border-b border-white/70 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--app-text-color)]">
                    Aksi
                  </p>
                  <p className="truncate text-xs text-[var(--app-hint-color)]">
                    {title}
                  </p>
                </div>
                <button
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-[var(--app-text-color)]"
                  onClick={() => setIsMenuOpen(false)}
                  type="button"
                  aria-label="Tutup menu aksi"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 px-4 py-4">
                {visibleActions.length > 0 ? (
                  visibleActions.map((action) => (
                    <ActionButton
                      key={action.id ?? action.label}
                      action={action}
                      onClick={handleActionClick}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-[var(--app-hint-color)]">
                    Tidak ada aksi yang tersedia untuk role Anda.
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <>
      <article
        className={`flex items-start justify-between gap-2 border-b border-slate-200/70 bg-transparent p-2 ${className}`}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {leadingIcon ? (
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[var(--app-text-color)]">
              {leadingIcon}
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <h3
              className={`truncate text-sm font-semibold text-[var(--app-text-color)] ${titleClassName}`}
            >
              {title}
            </h3>
            <p className="mt-0.5 truncate text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-2">
          <div className="flex min-w-0 flex-col items-end gap-1">
            {amount ? (
              <span
                className={`truncate text-sm font-semibold text-[var(--app-text-color)] ${amountClassName}`}
              >
                {amount}
              </span>
            ) : null}
            {badge ? (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeClassName}`}
              >
                {badge}
              </span>
            ) : null}
          </div>

          {visibleActions.length > 0 ? (
            <button
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[var(--app-text-color)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setIsMenuOpen(true)}
              type="button"
              aria-label={`Buka menu aksi untuk ${title}`}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </article>

      {sheet}
    </>
  )
}

export default ActionCard
