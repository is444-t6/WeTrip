import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

const REGION_ID = 'scantopay-qr-reader'

// The library throws below 50px, which happens if the video is removed mid-start.
const scanBox = (width, height) => {
  const size = Math.max(50, Math.floor(Math.min(width, height) * 0.8))
  return { width: size, height: size }
}

function cameraMessage() {
  return window.isSecureContext
    ? 'Camera unavailable. Allow camera access, or paste the QR text below.'
    : 'The camera needs HTTPS or localhost. Paste the QR text below instead.'
}

export default function QrScanner({ onScan }) {
  const [cameraError, setCameraError] = useState('')
  const onScanRef = useRef(onScan)
  // Starts and stops run one at a time. StrictMode mounts this twice in dev, and
  // the library breaks if a stop overlaps a start on the same element.
  const lifecycle = useRef(Promise.resolve())

  useEffect(() => {
    onScanRef.current = onScan
  })

  useEffect(() => {
    let unmounted = false
    let scanner = null
    let decoded = false

    lifecycle.current = lifecycle.current.then(async () => {
      if (unmounted) return
      const instance = new Html5Qrcode(REGION_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      })
      try {
        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: scanBox },
          (text) => {
            // Fires on every frame that holds a QR, so only take the first.
            if (decoded) return
            decoded = true
            onScanRef.current(text)
          },
          () => {}, // no QR in this frame
        )
        scanner = instance
      } catch {
        if (!unmounted) setCameraError(cameraMessage())
      }
    })

    return () => {
      unmounted = true
      lifecycle.current = lifecycle.current.then(async () => {
        if (!scanner) return
        try {
          await scanner.stop()
          scanner.clear()
        } catch {
          // Already stopped, or the region has left the page.
        }
      })
    }
  }, [])

  return (
    <>
      {cameraError && <p className="muted">{cameraError}</p>}
      <div id={REGION_ID} className="scantopay-reader" hidden={Boolean(cameraError)} />
    </>
  )
}
