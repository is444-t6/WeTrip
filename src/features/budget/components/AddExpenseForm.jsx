import { useState } from 'react'
import Banner from '../../family/components/Banner'
import { getSessionAccountId } from '../../family/session'
import { CATEGORIES, DEFAULT_CURRENCY, SOURCE } from '../constants'
import { useRecordSpending } from '../queries'

export default function AddExpenseForm({ tripId }) {
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id)
  const [merchant, setMerchant] = useState('')
  const [message, setMessage] = useState('')
  const record = useRecordSpending(tripId)

  function submit(e) {
    e.preventDefault()
    setMessage('')
    record.mutate(
      {
        TripId: Number(tripId),
        ChildAccountId: getSessionAccountId(),
        CategoryId: Number(categoryId),
        Amount: Number(amount),
        Currency: DEFAULT_CURRENCY,
        MerchantName: merchant,
        Description: '',
        ExpenseDate: new Date().toISOString().slice(0, 19),
        SourceId: SOURCE.MANUAL,
        BankTransactionId: '',
        ReceiptId: 0,
      },
      {
        onSuccess: (r) => {
          setMessage(r.hasAlert ? r.alertMessage : '')
          setAmount('')
          setMerchant('')
        },
      },
    )
  }

  return (
    <div className="card">
      <h3>Add expense</h3>
      <Banner>{record.error?.message}</Banner>
      <Banner>{message}</Banner>
      <form onSubmit={submit}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="budget-expense-amount">Amount ({DEFAULT_CURRENCY})</label>
            <input
              id="budget-expense-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="budget-expense-category">Category</label>
            <select
              id="budget-expense-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="budget-expense-merchant">Merchant (optional)</label>
          <input
            id="budget-expense-merchant"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
          />
        </div>
        <button disabled={record.isPending} type="submit" style={{ width: '100%' }}>
          {record.isPending ? 'Saving…' : 'Add expense'}
        </button>
      </form>
    </div>
  )
}
