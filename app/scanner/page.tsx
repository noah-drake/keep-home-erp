'use client'

import { useEffect, useRef, useState } from 'react'

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void
  onScanFailure?: (error: string) => void
  paused?: boolean // Ignored: We handle debouncing purely in React now
}

export default function BarcodeScanner({ onScanSuccess }: BarcodeScannerProps) {
  const [errorMsg, setErrorMsg] = useState<string>('')
  const isMounted = useRef(true)
  
  // Hard-lock to prevent multiple database calls without needing hardware-level pausing
  const hasScanned = useRef(false) 
  const successCallbackRef = useRef(onScanSuccess)

  useEffect(() => {
    successCallbackRef.current = onScanSuccess
  }, [onScanSuccess])

  useEffect(() => {
    isMounted.current = true
    let html5QrCode: any = null

    import('html5-qrcode').then((module) => {
      if (!isMounted.current) return
      
      // Use the RAW engine, not the buggy UI wrapper
      const Html5Qrcode = module.Html5Qrcode
      html5QrCode = new Html5Qrcode('raw-video-reader')

      html5QrCode.start(
        { facingMode: 'environment' }, // Force the back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText: string) => {
          // If we haven't scanned yet, lock it and fire the success route
          if (isMounted.current && !hasScanned.current) {
            hasScanned.current = true 
            successCallbackRef.current(decodedText)
          }
        },
        (errorMessage: string) => {
          // Ignore routine frame errors (like "No barcode found in this frame")
        }
      ).catch((err: any) => {
        if (isMounted.current) {
          setErrorMsg('Camera access denied or unavailable. Please check permissions.')
          console.error("Camera Start Error:", err)
        }
      })
    }).catch(err => {
      if (isMounted.current) setErrorMsg('Failed to load the camera engine.')
    })

    return () => {
      isMounted.current = false
      if (html5QrCode) {
        try {
          if (html5QrCode.isScanning) {
            html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error)
          }
        } catch (e) {
          console.error("Hardware cleanup bypassed", e)
        }
      }
    }
  }, [])

  return (
    <div className="w-full max-w-lg mx-auto bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-2xl relative">
      {errorMsg ? (
        <div className="p-6 text-red-500 text-xs font-bold text-center border border-red-900 bg-red-950/20 m-2 rounded-xl">
          {errorMsg}
        </div>
      ) : (
        <div id="raw-video-reader" className="w-full min-h-[300px] bg-black flex items-center justify-center">
           {/* This text shows only until the camera feed overwrites it */}
           <span className="text-gray-600 text-[10px] font-black uppercase tracking-widest animate-pulse">
             Mounting Camera Hardware...
           </span>
        </div>
      )}
    </div>
  )
}