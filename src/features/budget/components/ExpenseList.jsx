import { categoryName } from '../constants'

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
                <td data-label="Details">{e.merchantName || e.description || 'Expense'}</td>
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
