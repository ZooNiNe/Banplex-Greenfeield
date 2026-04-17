import ProtectedRoute from '../components/ProtectedRoute'
import MasterDataManager from '../components/MasterDataManager'

function MasterPage() {
  return (
    <section className="space-y-4 px-2 py-2">
      <div className="app-page-surface px-4 py-4">
        <p className="app-kicker">
          Master
        </p>
        <h1 className="app-title text-[1.2rem]">
          Universal Master Data CRUD
        </h1>
        <p className="app-copy">
          Kelola proyek, supplier, pekerja, staff, kategori, kreditur, profesi, dan referensi operasional.
        </p>
      </div>

      <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
        <MasterDataManager />
      </ProtectedRoute>
    </section>
  )
}

export default MasterPage
