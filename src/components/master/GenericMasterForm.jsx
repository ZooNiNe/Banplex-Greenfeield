import { useState } from 'react'

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()
  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function buildFormState(fields, initialData = null) {
  return fields.reduce((state, field) => {
    const rawValue = initialData?.[field.sourceKey ?? field.name]

    if (field.type === 'checkbox') {
      state[field.name] = Boolean(rawValue ?? field.defaultValue ?? false)
      return state
    }

    if (rawValue == null || rawValue === '') {
      state[field.name] =
        field.defaultValue == null ? '' : String(field.defaultValue)
      return state
    }

    state[field.name] = field.type === 'number' ? String(rawValue) : rawValue
    return state
  }, {})
}

function parseFormValues(fields, formState) {
  const payload = {}

  for (const field of fields) {
    const value = formState[field.name]

    if (field.type === 'checkbox') {
      payload[field.name] = Boolean(value)
      continue
    }

    if (field.required && !normalizeText(value)) {
      throw new Error(`${field.label} wajib diisi.`)
    }

    if (field.type === 'number') {
      const normalizedValue = normalizeText(value)

      if (!normalizedValue) {
        payload[field.name] = field.allowNull ? null : 0
        continue
      }

      const parsedValue = Number(normalizedValue)

      if (!Number.isFinite(parsedValue)) {
        throw new Error(`${field.label} harus berupa angka yang valid.`)
      }

      payload[field.name] = parsedValue
      continue
    }

    payload[field.name] = normalizeText(value, null)
  }

  return payload
}

function GenericMasterForm({
  config,
  initialData = null,
  isSubmitting = false,
  formId = null,
  hideActions = false,
  onSubmit,
}) {
  const [formState, setFormState] = useState(() =>
    buildFormState(config.fields, initialData)
  )
  const [localError, setLocalError] = useState(null)

  const handleChange = (fieldName, nextValue) => {
    setFormState((current) => ({
      ...current,
      [fieldName]: nextValue,
    }))

    if (localError) {
      setLocalError(null)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      const payload = parseFormValues(config.fields, formState)
      await onSubmit(payload)
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : 'Gagal menyimpan master data.'
      )
    }
  }

  return (
    <form id={formId ?? undefined} className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        {config.fields.map((field) => {
          if (field.type === 'textarea') {
            return (
              <label
                key={field.name}
                className={`block space-y-2 ${field.fullWidth ? 'sm:col-span-2' : ''}`}
              >
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  {field.label}
                </span>
                <textarea
                  className="min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  name={field.name}
                  onChange={(event) => handleChange(field.name, event.target.value)}
                  placeholder={field.placeholder}
                  value={formState[field.name] ?? ''}
                />
              </label>
            )
          }

          if (field.type === 'select') {
            return (
              <label key={field.name} className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  {field.label}
                </span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  name={field.name}
                  onChange={(event) => handleChange(field.name, event.target.value)}
                  value={formState[field.name] ?? ''}
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )
          }

          if (field.type === 'checkbox') {
            return (
              <label
                key={field.name}
                className={`inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 ${field.fullWidth ? 'sm:col-span-2' : ''}`}
              >
                <input
                  checked={Boolean(formState[field.name])}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  name={field.name}
                  onChange={(event) =>
                    handleChange(field.name, event.target.checked)
                  }
                  type="checkbox"
                />
                {field.label}
              </label>
            )
          }

          return (
            <label
              key={field.name}
              className={`block space-y-2 ${field.fullWidth ? 'sm:col-span-2' : ''}`}
            >
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                {field.label}
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                inputMode={field.inputMode}
                min={field.min}
                name={field.name}
                onChange={(event) => handleChange(field.name, event.target.value)}
                placeholder={field.placeholder}
                step={field.step}
                type={field.type === 'number' ? 'number' : 'text'}
                value={formState[field.name] ?? ''}
              />
            </label>
          )
        })}
      </div>

      {localError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          {localError}
        </div>
      ) : null}

      {hideActions ? null : (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex items-center justify-center rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[var(--app-text-color)]"
            type="button"
          >
            Batal
          </button>

          <button
            className="inline-flex items-center justify-center rounded-[20px] bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      )}
    </form>
  )
}

export default GenericMasterForm
