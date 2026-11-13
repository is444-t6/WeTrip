import { useRef, useState } from 'react'
import Banner from '../../components/Banner'
import { CATEGORIES } from '../budget/constants'
import { newRequestId } from './api'
import { useAddReceipt } from './queries'

const MAX_EDGE = 1280
const MAX_BYTES = 1024 * 1024

// Shrinks the photo in the browser (longest edge 1280 px, JPEG) so the upload stays
// well under the proxy's body limit. Returns the base64 and its size in bytes.
async function shrink(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // JPEG has no alpha; a transparent PNG would turn black
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
  return { base64, bytes: base64.length * 0.75 }
}

// A cash receipt: the child types the amount (no OCR) and may attach a photo. It
// only records a budget expense; no money moves and the trip pot is unchanged.
export default function ReceiptForm({ trip }) {
  const [open, setOpen] = useState(false)
  return open ? (
    <ReceiptFields trip={trip} onClose={() => setOpen(false)} />
  ) : (
    <button
      type="button"
      className="secondary"
      style={{ marginTop: 12 }}
      onClick={() => setOpen(true)}
    >
      Add a receipt
    </button>
  )
}

// Mounted fresh each time the form opens, so every attempt gets its own request id.
function ReceiptFields({ trip, onClose }) {
  const add = useAddReceipt(trip.id)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(trip.currency)
  const [categoryId, setCategoryId] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoError, setPhotoError] = useState('')
  const [resizing, setResizing] = useState(false)
  const [error, setError] = useState('')
  const [requestId] = useState(newRequestId)
  const sending = useRef(false)

  async function pick(e) {
    const file = e.target.files?.[0]
    setPhoto(null)
    setPhotoError('')
    if (!file) return
    setResizing(true)
    try {
      const { base64, bytes } = await shrink(file)
      if (bytes > MAX_BYTES) setPhotoError('That photo is too large')
      else setPhoto(base64)
    } catch {
      setPhotoError("We couldn't read that photo")
    }
    setResizing(false)
  }

  function submit(e) {
    e.preventDefault()
    if (sending.current || photoError) return
    if (!(Number(amount) > 0)) return setError('Enter an amount above 0')
    if (!categoryId) return setError('Pick a category')
    setError('')
    sending.current = true
    add.mutate(
      {
        TripId: Number(trip.id),
        Amount: Number(amount),
        Currency: currency,
        CategoryId: Number(categoryId),
        RequestId: requestId,
        ...(photo && { ImageBase64: photo, ContentType: 'image/jpeg' }),
      },
      { onSuccess: onClose, onSettled: () => (sending.current = false) },
    )
  }

  return (
    <form className="card" noValidate style={{ marginTop: 12 }} onSubmit={submit}>
      <h3 style={{ marginTop: 0 }}>Add a receipt</h3>
      <p className="muted">
        For something you paid in cash. We don't read the photo, so type the amount from the
        receipt. It only adds to your budget; no money moves.
      </p>
      <Banner>{error || add.error?.message}</Banner>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="receipt-amount">Amount</label>
          <input
            id="receipt-amount"
            type="number"
            inputMode="decimal"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="receipt-currency">Currency</label>
          <select
            id="receipt-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {[...new Set([trip.currency, 'SGD'])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="receipt-category">Category</label>
        <select
          id="receipt-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Choose a category</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="receipt-photo">Photo of the receipt (optional)</label>
        <input id="receipt-photo" type="file" accept="image/jpeg,image/png" onChange={pick} />
      </div>
      <Banner>{photoError}</Banner>
      <div className="row" style={{ gap: 8 }}>
        <button type="submit" disabled={add.isPending || resizing}>
          {add.isPending ? 'Saving…' : 'Save receipt'}
        </button>
        <button type="button" className="secondary" disabled={add.isPending} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  )
}
