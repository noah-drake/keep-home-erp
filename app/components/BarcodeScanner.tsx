'use client'

import { useEffect, useRef, useState } from 'react'
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode'

interface BarcodeScannerProps {
  /** Called once with the decoded value the first time a code is read. */
  onScanSuccess: (decodedText: string) => void
}

const VIEWPORT_ID = 'keep-secure-optics-viewport'

/**
 * Camera-based barcode/QR reader built on html5-qrcode. This is a "dumb" component: it owns
 * the camera lifecycle and reports a decoded value via onScanSuccess — the parent decides
 * what to do with it. Mounting starts the camera; unmounting tears it down safely.
 *
 * Mobile gotchas handled here:
 *  - getUserMedia only exists in a secure context, so we fail loudly with guidance on plain http.
 *  - iOS Safari's facingMode:'environment' is unreliable, so we enumerate and pick a rear camera.
 *  - React 19 Strict Mode double-mounts in dev, so teardown awaits any in-flight start().
 */
export default function BarcodeScanner({ onScanSuccess }: BarcodeScannerProps) {
  const [status, setStatus] = useState<string>('INITIALIZING HARDWARE...')
  const [errorMsg, setErrorMsg] = useState<string>('')

  const scannerRef = useRef<Html5QrcodeType | null>(null)
  const isMounted = useRef(true)
  const hasScanned = useRef(false)
  const startPromise = useRef<Promise<unknown> | null>(null)

  useEffect(() => {
    isMounted.current = true
    hasScanned.current = false

    // getUserMedia is gated to secure contexts. A phone on http://<lan-ip>:3000 is neither
    // HTTPS nor localhost, so the camera API is simply absent — say so instead of failing silently.
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setErrorMsg('CAMERA REQUIRES HTTPS: Open this app over a secure https:// URL on your phone. Plain http will not grant camera access.')
      setStatus('')
      return
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('CAMERA UNAVAILABLE: This browser blocked camera access. On iPhone, open the app in Safari.')
      setStatus('')
      return
    }

    const mountCamera = async () => {
      try {
        // Dynamic import keeps this library out of the server bundle (it touches window).
        const { Html5Qrcode } = await import('html5-qrcode')
        if (!isMounted.current) return

        const scanner = new Html5Qrcode(VIEWPORT_ID)
        scannerRef.current = scanner

        const config = {
          fps: 10,
          // Responsive reticle: 70% of the smaller viewport edge, never larger than the frame.
          qrbox: (viewW: number, viewH: number) => {
            const size = Math.floor(Math.min(viewW, viewH) * 0.7)
            return { width: size, height: size }
          },
        }

        const onDecode = (decodedText: string) => {
          if (isMounted.current && !hasScanned.current) {
            hasScanned.current = true
            setStatus('BARCODE ACQUIRED! ROUTING...')
            // Brief pause so the success message is visible before the parent navigates away.
            setTimeout(() => onScanSuccess(decodedText), 300)
          }
        }

        setStatus('REQUESTING OPTICS PERMISSION...')

        // Prefer an explicit rear camera by deviceId (robust on iOS); fall back to the
        // environment-facing constraint if enumeration is unavailable or denied.
        let cameraConfig: string | MediaTrackConstraints = { facingMode: 'environment' }
        try {
          const cameras = await Html5Qrcode.getCameras()
          if (cameras?.length) {
            const rear = cameras.find(c => /back|rear|environment/i.test(c.label)) ?? cameras[cameras.length - 1]
            cameraConfig = rear.id
          }
        } catch {
          // Enumeration failed — let start() surface the real permission/hardware error below.
        }
        if (!isMounted.current) return

        const started = scanner.start(cameraConfig, config, onDecode, undefined)
        startPromise.current = started
        await started

        if (isMounted.current) setStatus('') // Clear overlay to reveal the live feed.
      } catch (err) {
        if (isMounted.current) {
          console.error('Camera Hardware Error:', err)
          setErrorMsg('OPTICS OFFLINE: Camera permission was denied or no camera was found. On iPhone, re-enable it in Settings > Safari > Camera.')
          setStatus('')
        }
      }
    }

    mountCamera()

    return () => {
      isMounted.current = false
      const teardown = async () => {
        // Wait out any in-flight start() so we never stop() a scanner that never started.
        try { await startPromise.current } catch { /* start already rejected */ }
        const scanner = scannerRef.current
        if (!scanner) return
        try {
          const { Html5QrcodeScannerState } = await import('html5-qrcode')
          if (scanner.getState() === Html5QrcodeScannerState.SCANNING) {
            await scanner.stop()
          }
          scanner.clear()
        } catch (e) {
          console.error('Hardware cleanup bypassed', e)
        } finally {
          scannerRef.current = null
        }
      }
      teardown()
    }
  }, [onScanSuccess])

  return (
    <div className="w-full max-w-lg mx-auto bg-[#050505] rounded-[2rem] overflow-hidden border border-gray-800 shadow-2xl relative">
      {errorMsg ? (
        <div className="p-6 text-red-500 text-xs font-bold text-center border border-red-900 bg-red-950/20 m-4 rounded-xl leading-relaxed">
          {errorMsg}
        </div>
      ) : (
        <div className="relative w-full min-h-[350px] bg-[#050505] flex items-center justify-center">

          {/* The actual video feed container */}
          <div id={VIEWPORT_ID} className="w-full h-full absolute inset-0 [&>video]:object-cover" />

          {/* Status Overlay */}
          {status && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 backdrop-blur-md">
              <span className="text-purple-500 text-[10px] font-black uppercase tracking-widest animate-pulse px-6 text-center leading-relaxed">
                {status}
              </span>
            </div>
          )}

          {/* Tactical Targeting Reticle (Only shows when camera is live) */}
          {!status && !errorMsg && (
            <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
              <div className="w-56 h-56 relative">
                {/* Corner Brackets */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-purple-500/80 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-purple-500/80 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-purple-500/80 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-purple-500/80 rounded-br-xl" />

                {/* Laser Line */}
                <div className="absolute top-1/2 left-0 w-full h-[2px] bg-red-500/80 shadow-[0_0_12px_rgba(239,68,68,1)] animate-pulse" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
