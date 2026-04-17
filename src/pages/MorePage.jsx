import ProtectedRoute from '../components/ProtectedRoute'
import BeneficiaryList from '../components/BeneficiaryList'
import HrdPipeline from '../components/HrdPipeline'
import PayrollManager from '../components/PayrollManager'
import TeamInviteManager from '../components/TeamInviteManager'
import { useNavigate } from 'react-router-dom'
import { FileText, ScanFace } from 'lucide-react'

const modules = [
  {
    title: 'SDM & Payroll',
    description: 'Rekap absensi dan tagihan gaji.',
    component: PayrollManager,
    roles: ['Owner', 'Admin', 'Payroll'],
  },
  {
    title: 'HRD & Rekrutmen',
    description: 'Kelola pelamar dan dokumen pendukung.',
    component: HrdPipeline,
    roles: ['Owner', 'Admin'],
  },
  {
    title: 'Penerima Manfaat',
    description: 'Data penerima manfaat untuk operasional.',
    component: BeneficiaryList,
    roles: ['Owner', 'Admin'],
  },
  {
    title: 'Team Invite',
    description: 'Magic invite link dan kontrol role anggota.',
    component: TeamInviteManager,
    roles: ['Owner'],
  },
]

function MorePage() {
  const navigate = useNavigate()

  return (
    <section className="space-y-4 px-2 py-2">
      <div className="app-page-surface px-4 py-4">
        <p className="app-kicker">
          Lainnya
        </p>
        <h1 className="app-title text-[1.2rem]">
          SDM, HRD, dan Utilitas
        </h1>
        <p className="app-copy">
          Menu tambahan untuk fungsi operasional yang tidak masuk dashboard utama.
        </p>
      </div>

      <section className="app-page-surface px-4 py-4">
        <p className="app-kicker">
          Form Cepat
        </p>
        <h2 className="app-title">
          Akses faktur dan absensi langsung
        </h2>
        <p className="app-copy">
          Dua form yang sempat tersembunyi sekarang bisa dibuka dari sini.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className="flex items-center gap-3 rounded-[22px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-4 py-4 text-left transition active:scale-[0.99]"
            onClick={() => navigate('/material-invoice/new')}
            type="button"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <FileText className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--app-text-color)]">
                Faktur Material
              </span>
              <span className="block text-xs text-[var(--app-hint-color)]">
                Invoice dan surat jalan
              </span>
            </span>
          </button>

          <button
            className="flex items-center gap-3 rounded-[22px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-4 py-4 text-left transition active:scale-[0.99]"
            onClick={() => navigate('/attendance/new')}
            type="button"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <ScanFace className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--app-text-color)]">
                Absensi
              </span>
              <span className="block text-xs text-[var(--app-hint-color)]">
                Catat kehadiran harian
              </span>
            </span>
          </button>
        </div>
      </section>

      <div className="space-y-4">
        {modules.map((module) => {
          const ModuleComponent = module.component

          return (
            <ProtectedRoute key={module.title} allowedRoles={module.roles}>
              <section className="app-page-surface px-4 py-4">
                <div className="mb-3">
                  <p className="app-kicker">
                    {module.title}
                  </p>
                  <p className="app-copy">
                    {module.description}
                  </p>
                </div>
                <ModuleComponent />
              </section>
            </ProtectedRoute>
          )
        })}
      </div>
    </section>
  )
}

export default MorePage
