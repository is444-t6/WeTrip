import { useState } from 'react'
import Banner from '../../family/components/Banner'
import { getSessionAccountId } from '../../family/session'
import { CATEGORIES, DEFAULT_CURRENCY } from '../constants'
import { useSetBudget } from '../queries'

export default function SetBudgetForm({ tripId }) {
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id)
  const [limit, setLimit] = useState('')
  const [message, setMessage] = useState('')
  const setBudget = useSetBudget(tripId)

  function submit(e) {
    e.preventDefault()
    setMessage('')
    setBudget.mutate(
      {
        TripId: Number(tripId),
        ChildAccountId: getSessionAccountId(), // TODO: the child's account once linked to Tim's family link
        CategoryId: Number(categoryId),
        LimitAmount: Number(limit),
        Currency: DEFAULT_CURRENCY,
      },
      {
        onSuccess: () => {
          setMessage('Budget saved.')
          setLimit('')
        },
      },
    )
  }

  return (
    <div className="card">
      <h3>Set category budget</h3>
      <Banner>{setBudget.error?.message}</Banner>
      <Banner kind="ok">{message}</Banner>
      <form onSubmit={submit}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="budget-set-category">Category</label>
            <select
              id="budget-set-category"
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
          <div className="field">
            <label htmlFor="budget-set-limit">Limit ({DEFAULT_CURRENCY})</label>
            <input
              id="budget-set-limit"
              type="number"
              step="0.01"
              min="0"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              required
            />
          </div>
        </div>
        <button disabled={setBudget.isPending} type="submit" style={{ width: '100%' }}>
          {setBudget.isPending ? 'Saving…' : 'Save budget'}
        </button>
      </form>
    </div>
  )
}
