import ProtectedRoute from '../components/ProtectedRoute'
import ProjectReport from '../components/ProjectReport'

function ProjectsPage() {
  return (
    <section className="space-y-4 px-2 py-2">
      <div className="app-page-surface px-4 py-4">
        <p className="app-kicker">
          Proyek
        </p>
        <h1 className="app-title text-[1.2rem]">
          Laporan dan Breakdown Proyek
        </h1>
        <p className="app-copy">
          Ringkasan laba, biaya, dan beban gaji untuk proyek utama dan internal.
        </p>
      </div>

      <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
        <ProjectReport />
      </ProtectedRoute>
    </section>
  )
}

export default ProjectsPage
