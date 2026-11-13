import { useRef, useState } from 'react'
import Banner from '../../../components/Banner'
import { newRequestId } from '../../trips/api'
import { useAddFixedCost } from '../../trips/queries'
import { blankFixedCost } from '../constants'
import FixedCostFields from './FixedCostFields'

// Parent only, open trips. Recorded through Trip.AddFixedCost, not RecordSpending.
export default function AddFixedCostForm({ tripId }) {
  const [cost, setCost] = useState(blankFixedCost)
  const [message, setMessage] = useState('')
  const requestId = useRef(null)
  const add = useAddFixedCost(tripId)

  // The id lives as long as the attempt: resending the same cost after a lost
  // reply is a no-op on the server, while an edited cost gets a new id.
  function change(next) {
    requestId.current = null
    setCost(next)
  }

  function submit(e) {
    e.preventDefault()
    setMessage('')
    requestId.current ??= newRequestId()
    add.mutate(
      {
        TripId: Number(tripId),
        Name: cost.name.trim(),
        CategoryId: Number(cost.categoryId),
        AmountSgd: Number(cost.amount),
        RequestId: requestId.current,
      },
      {
        onSuccess: () => {
          requestId.current = null
          setCost(blankFixedCost())
          setMessage('Fixed cost added.')
        },
      },
    )
  }

  return (
    <div className="card" aria-label="Add a fixed cost">
      <h3>Add a fixed cost</h3>
      <p className="muted" style={{ margin: '0 0 12px' }}>
        A known upfront cost such as the hotel. It counts as spent in its category.
      </p>
      <Banner>{add.error?.message}</Banner>
      <Banner kind="ok">{message}</Banner>
      <form onSubmit={submit}>
        <FixedCostFields id="budget-fixed" value={cost} onChange={change} />
        <button disabled={add.isPending} type="submit" style={{ width: '100%' }}>
          {add.isPending ? 'Saving…' : 'Add a fixed cost'}
        </button>
      </form>
    </div>
  )
}
