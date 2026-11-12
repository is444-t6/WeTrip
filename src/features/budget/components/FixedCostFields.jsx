import { CATEGORIES } from '../constants'

// Name, category and SGD amount of one fixed cost; shared by the new-trip form
// and the budget page. `value` is { name, categoryId, amount } as typed.
export default function FixedCostFields({ id, value, onChange }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value })
  return (
    <div className="fixed-cost-fields">
      <div className="field">
        <label htmlFor={`${id}-name`}>Name</label>
        <input
          id={`${id}-name`}
          value={value.name}
          onChange={set('name')}
          maxLength={40}
          placeholder="Hotel"
          required
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-category`}>Category</label>
        <select id={`${id}-category`} value={value.categoryId} onChange={set('categoryId')}>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-amount`}>Amount (SGD)</label>
        <input
          id={`${id}-amount`}
          type="number"
          step="0.01"
          min="0.01"
          value={value.amount}
          onChange={set('amount')}
          required
        />
      </div>
    </div>
  )
}
