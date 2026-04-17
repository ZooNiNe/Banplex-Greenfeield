import { ArrowLeft } from 'lucide-react'

function FormLayout({
  title,
  onBack,
  actionLabel = 'Selanjutnya',
  formId = null,
  isSubmitting = false,
  submitDisabled = false,
  children,
}) {
  return (
    <div className="fixed left-0 top-0 z-[100] h-screen w-full bg-[var(--app-bg-color)]">
      <div className="flex h-full w-full flex-col">
        <header className="flex shrink-0 items-center border-b border-[var(--app-border-color)] bg-[var(--app-surface-color)] px-4 py-3">
          <button
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--app-border-color)] bg-transparent text-[var(--app-text-color)] transition hover:bg-black/5"
            onClick={onBack}
            type="button"
            aria-label="Kembali"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <h1 className="min-w-0 flex-1 px-2 text-center text-base font-semibold text-[var(--app-text-color)]">
            {title}
          </h1>

          <div className="h-11 w-11 shrink-0" aria-hidden="true" />
        </header>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {formId ? (
          <footer className="shrink-0 border-t border-[var(--app-border-color)] bg-[var(--app-surface-color)] p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            <button
              className="w-full rounded-2xl bg-[var(--app-button-color)] px-4 py-3 text-sm font-semibold text-[var(--app-button-text-color)] transition disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitDisabled || isSubmitting}
              form={formId}
              type="submit"
            >
              {isSubmitting ? 'Menyimpan...' : actionLabel}
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  )
}

export default FormLayout
