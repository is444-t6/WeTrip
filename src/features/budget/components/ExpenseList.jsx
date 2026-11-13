import { useState } from 'react'
import Banner from '../../../components/Banner'
import { useReceipt } from '../../trips/queries'
import { SOURCE, categoryName } from '../constants'

// Opens the stored photo (Trip.GetReceipt) full size, only once it is tapped.
function ReceiptPhoto({ receiptId }) {
  const [open, setOpen] = useState(false)
  const photo = useReceipt(receiptId, open)
  return (
    <>
      <button type="button" className="badge active" onClick={() => setOpen(true)}>
        Receipt
      </button>
      {open && (
        <dialog
          ref={(d) => d && !d.open && d.showModal()}
          aria-label="Receipt photo"
          onClose={() => setOpen(false)}
        >
          <Banner>{photo.error?.message}</Banner>
          {photo.isLoading && <p className="muted">Loading…</p>}
          {photo.data && (
            <img
              alt="Receipt"
              style={{ display: 'block', maxWidth: '100%' }}
              src={`data:${photo.data.contentType};base64,${photo.data.imageBase64}`}
            />
          )}
          <form method="dialog" style={{ marginTop: 12 }}>
            <button type="submit" className="secondary">
              Close
            </button>
          </form>
        </dialog>
      )}
    </>
  )
}

export default function ExpenseList({ expenses }) {
  return (
    <div className="card">
      {!expenses?.length && <p className="muted">No expenses yet.</p>}
      {expenses?.length > 0 && (
        <table className="stack-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Details</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td data-label="Date">{String(e.expenseDate).slice(0, 10)}</td>
                <td data-label="Details">
                  {e.merchantName || e.description || 'Expense'}
                  {Number(e.sourceId) === SOURCE.FIXED && (
                    <>
                      {' '}
                      <span className="badge">Fixed</span>
                    </>
                  )}
                  {Number(e.sourceId) === SOURCE.RECEIPT && (
                    <>
                      {' '}
                      {Number(e.receiptId) > 0 ? (
                        <ReceiptPhoto receiptId={e.receiptId} />
                      ) : (
                        <span className="badge active">Receipt</span>
                      )}
                    </>
                  )}
                </td>
                <td data-label="Category" className="muted">
                  {categoryName(e.categoryId)}
                </td>
                <td data-label="Amount" style={{ textAlign: 'right' }}>
                  {Number(e.amount).toFixed(2)} {e.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
