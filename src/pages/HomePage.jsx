import { Bot, Database, Send, ShieldCheck } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'

function getDisplayName(user) {
  return user?.first_name || user?.username || 'Banplex Builder'
}

function getUserMeta(user) {
  if (user?.username) {
    return `@${user.username}`
  }

  if (user?.id) {
    return `Telegram ID ${user.id}`
  }

  return 'Buka aplikasi ini dari Telegram untuk membaca profil pengguna.'
}

function HomePage({ user, hasMainButton, isSupabaseConfigured }) {
  const displayName = getDisplayName(user)
  const userMeta = getUserMeta(user)

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-8rem] h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[-6rem] h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <section className="app-page-surface w-full overflow-hidden">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.35fr_0.9fr] lg:p-10">
            <div className="space-y-6">
              <div className="app-chip bg-white/75 text-slate-600">
                <Bot className="h-4 w-4 text-sky-600" strokeWidth={2.25} />
                Telegram Mini App
              </div>

              <div className="space-y-4">
                <p className="app-kicker">
                  Banplex Greenfield
                </p>
                <h1 className="max-w-xl text-3xl font-semibold tracking-[-0.04em] text-[var(--app-text-color)] sm:text-4xl">
                  Halo, {displayName}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[var(--app-hint-color)] sm:text-lg">
                  Fondasi React, Vite, Tailwind CSS, Zustand, Supabase Client,
                  dan Vercel Serverless sudah siap untuk iterasi fitur berikutnya.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--app-hint-color)]">
                <span className="rounded-full border border-white/70 bg-white/70 px-3 py-1.5">
                  {userMeta}
                </span>
                <span className="rounded-full border border-white/70 bg-white/70 px-3 py-1.5">
                  WebApp {user ? 'terhubung' : 'mode browser biasa'}
                </span>
              </div>
            </div>

            <aside className="grid gap-3">
              <StatusBadge
                icon={Send}
                label="Main Button"
                tone={hasMainButton ? 'success' : 'warning'}
                value={
                  hasMainButton
                    ? 'SDK Telegram mendeteksi MainButton.'
                    : 'Belum tersedia di browser non-Telegram.'
                }
              />
              <StatusBadge
                icon={Database}
                label="Supabase"
                tone={isSupabaseConfigured ? 'success' : 'info'}
                value={
                  isSupabaseConfigured
                    ? 'Client siap dipakai lewat env VITE_SUPABASE_*.'
                    : 'Tambahkan env Supabase untuk mulai query data.'
                }
              />
              <StatusBadge
                icon={ShieldCheck}
                label="Fondasi"
                tone="neutral"
                value="Router, store, hook, dan struktur folder enterprise sudah tersusun."
              />
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}

export default HomePage
export { HomePage }
