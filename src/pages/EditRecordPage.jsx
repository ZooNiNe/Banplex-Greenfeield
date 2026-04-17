import { useLocation, useNavigate, useParams } from 'react-router-dom'
import FormLayout from '../components/layouts/FormLayout'
import IncomeForm from '../components/IncomeForm'
import LoanForm from '../components/LoanForm'
import TransactionForm from '../components/TransactionForm'

function formatValue(value) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : '-'
}

function EditRecordPage() {
  const navigate = useNavigate()
  const { type, id } = useParams()
  const location = useLocation()
  const item = location.state?.item ?? location.state?.record ?? null
  const isCreateMode = id === 'new'
  const normalizedType = String(type ?? '').trim().toLowerCase()

  const handleBack = () => {
    navigate(-1)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    navigate(-1)
  }

  return (
    <FormLayout
      actionLabel="Selanjutnya"
      onBack={handleBack}
      onSubmit={handleSubmit}
      submitDisabled={false}
      title={`${isCreateMode ? 'Tambah' : 'Edit'} ${formatValue(type)}`}
    >
      <div className="space-y-4">
        <section className="app-section-surface p-4">
          <p className="app-kicker">
            Route edit
          </p>
          <h2 className="app-title">
            {formatValue(type)} / {formatValue(id)}
          </h2>
          <p className="app-copy">
            Form layar penuh sudah dibuka tanpa modal. Detail edit untuk tipe ini
            bisa diisi dari `location.state` atau dipetakan ke modul sumber berikutnya.
          </p>
        </section>

        {isCreateMode && normalizedType === 'income' ? (
          <TransactionForm initialType="income" onSuccess={handleBack} />
        ) : null}

        {isCreateMode && normalizedType === 'expense' ? (
          <TransactionForm initialType="expense" onSuccess={handleBack} />
        ) : null}

        {isCreateMode && normalizedType === 'loan' ? (
          <LoanForm onSuccess={handleBack} />
        ) : null}

        {isCreateMode && normalizedType === 'project-income' ? (
          <IncomeForm onSuccess={handleBack} />
        ) : null}

        <section className="app-section-surface p-4">
          <p className="text-sm font-semibold text-[var(--app-text-color)]">Ringkasan Data</p>
          <div className="mt-3 space-y-2 text-sm text-[var(--app-hint-color)]">
            <p>
              <span className="font-medium">ID:</span> {formatValue(id)}
            </p>
            <p>
              <span className="font-medium">Tipe:</span> {formatValue(type)}
            </p>
            <p>
              <span className="font-medium">Nama:</span>{' '}
              {formatValue(
                item?.title ??
                  item?.description ??
                  item?.category ??
                  item?.supplierName ??
                  item?.creditor_name_snapshot
              )}
            </p>
            <p>
              <span className="font-medium">Catatan:</span>{' '}
              {formatValue(item?.notes ?? item?.description)}
            </p>
          </div>
        </section>
      </div>
    </FormLayout>
  )
}

export default EditRecordPage
