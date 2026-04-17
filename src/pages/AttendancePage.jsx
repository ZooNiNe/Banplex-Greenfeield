import { useNavigate } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import FormLayout from '../components/layouts/FormLayout'
import AttendanceForm from '../components/AttendanceForm'
import useAttendanceStore from '../store/useAttendanceStore'

function AttendancePage() {
  const navigate = useNavigate()
  const formId = 'attendance-form'
  const isSheetSaving = useAttendanceStore((state) => state.isSheetSaving)

  return (
    <ProtectedRoute
      allowedRoles={['Owner', 'Admin', 'Payroll']}
      description="Absensi hanya tersedia untuk Owner, Admin, dan Payroll."
    >
      <FormLayout
        actionLabel="Simpan Sheet Absensi"
        formId={formId}
        isSubmitting={isSheetSaving}
        onBack={() => navigate(-1)}
        title="Absensi Harian"
      >
        <section className="space-y-4">
          <div className="app-page-surface p-4">
            <p className="app-kicker">
              Absensi Harian
            </p>
            <h2 className="app-title">
              Input banyak worker dalam satu tanggal
            </h2>
            <p className="app-copy">
              Record harian disimpan per worker, upah dihitung otomatis dari wage
              rate, lalu payroll akan membundel tagihan per worker.
            </p>
          </div>

          <AttendanceForm formId={formId} hideActions />
        </section>
      </FormLayout>
    </ProtectedRoute>
  )
}

export default AttendancePage
