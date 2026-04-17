import { useNavigate } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import FormLayout from '../components/layouts/FormLayout'
import MaterialInvoiceForm from '../components/MaterialInvoiceForm'

function MaterialInvoicePage() {
  const navigate = useNavigate()
  const formId = 'material-invoice-form'

  return (
    <ProtectedRoute
      allowedRoles={['Owner', 'Admin', 'Logistik']}
      description="Faktur material hanya tersedia untuk Owner, Admin, dan Logistik."
    >
      <FormLayout
        actionLabel="Simpan Faktur Material"
        formId={formId}
        onBack={() => navigate(-1)}
        title="Faktur Material"
      >
        <section className="space-y-4">
          <div className="app-page-surface p-4">
            <p className="app-kicker">
              Material Invoice
            </p>
            <h2 className="app-title">
              Buat faktur material atau surat jalan
            </h2>
            <p className="app-copy">
              Form ini terhubung langsung ke store transaksi material dan tetap aman
              dipakai di mobile webview.
            </p>
          </div>

          <MaterialInvoiceForm
            formId={formId}
            hideActions
            onSuccess={() => navigate(-1)}
          />
        </section>
      </FormLayout>
    </ProtectedRoute>
  )
}

export default MaterialInvoicePage
