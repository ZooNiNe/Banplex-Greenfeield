import { createElement } from 'react'

function StatusBadge({ icon, label, value, tone = 'neutral' }) {
  const toneClassName = {
    neutral: 'border-slate-200/80 bg-white/70 text-slate-800',
    info: 'border-sky-200/80 bg-sky-500/10 text-sky-900',
    success: 'border-emerald-200/80 bg-emerald-500/10 text-emerald-900',
    warning: 'border-amber-200/80 bg-amber-400/15 text-amber-900',
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 backdrop-blur ${toneClassName[tone] ?? toneClassName.neutral}`}
    >
      <span className="mt-0.5 rounded-xl bg-black/5 p-2">
        {createElement(icon, { className: 'h-4 w-4', strokeWidth: 2.25 })}
      </span>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
          {label}
        </p>
        <p className="text-sm font-medium leading-6">{value}</p>
      </div>
    </div>
  )
}

export default StatusBadge
export { StatusBadge }
