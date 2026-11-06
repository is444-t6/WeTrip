import { categoryName } from '../constants'

export default function ExpenseList({ expenses }) {
  return (
    <div className="card">
      {!expenses?.length && <p className="muted">No expenses yet.</p>}
      {expenses?.length > 0 && (
        <table>
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
                <td>{String(e.expenseDate).slice(0, 10)}</td>
                <td>{e.merchantName || e.description || 'Expense'}</td>
                <td className="muted">{categoryName(e.categoryId)}</td>
                <td style={{ textAlign: 'right' }}>
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
