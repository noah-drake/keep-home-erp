'use client'

import { useEffect, useRef, useState } from 'react'

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void
  onScanFailure?: (error: string) => void
  paused?: boolean // Ignored by hardware, retained for prop compatibility
}

export default function BarcodeScanner({ onScanSuccess }: BarcodeScannerProps) {
  const [status, setStatus] = useState<string>('INITIALIZING HARDWARE...')
  const [errorMsg, setErrorMsg] = useState<string>('')
  
  const scannerRef = useRef<any>(null)
  const isMounted = useRef(true)
  const hasScanned = useRef(false)

  useEffect(() => {
    isMounted.current = true
    hasScanned.current = false

    const mountCamera = async () => {
      try {
        // 1. Dynamic import to protect the Next.js server
        const module = await import('html5-qrcode')
        if (!isMounted.current) return

        const Html5Qrcode = module.Html5Qrcode
        
        // 2. CACHE BUSTER: Brand new HTML ID. Old cached scripts cannot target this.
        const scanner = new Html5Qrcode('keep-secure-optics-viewport')
        scannerRef.current = scanner

        setStatus('REQUESTING OPTICS PERMISSION...')

        // 3. Start the raw video engine
        await scanner.start(
          { facingMode: 'environment' }, // Force back camera
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 }, 
            aspectRatio: 1.0 
          },
          (decodedText) => {
            // Lock the scanner immediately upon successful read
            if (isMounted.current && !hasScanned.current) {
              hasScanned.current = true
              setStatus('BARCODE ACQUIRED! ROUTING...')
              
              // 300ms delay so the user can read the success message before the page changes
              setTimeout(() => {
                onScanSuccess(decodedText)
              }, 300)
            }
          },
          (errorMessage) => {
            // Silently ignore routine frame failures ("no barcode found")
          }
        )
        
        if (isMounted.current) setStatus('') // Clear status to show the video feed

      } catch (err: any) {
        if (isMounted.current) {
          console.error('Camera Hardware Error:', err)
          setErrorMsg('OPTICS OFFLINE: Please allow camera permissions in your browser settings.')
          setStatus('')
        }
      }
    }

    mountCamera()

    return () => {
      isMounted.current = false
      if (scannerRef.current) {
        try {
          // Gracefully release the camera hardware
          scannerRef.current.stop().then(() => {
            scannerRef.current.clear()
          }).catch(console.error)
        } catch (e) {
          console.error("Hardware cleanup bypassed", e)
        }
      }
    }
  }, [onScanSuccess])

  return (
    <div className="w-full max-w-lg mx-auto bg-[#050505] rounded-[2rem] overflow-hidden border border-gray-800 shadow-2xl relative">
      {errorMsg ? (
        <div className="p-6 text-red-500 text-xs font-bold text-center border border-red-900 bg-red-950/20 m-4 rounded-xl">
          {errorMsg}
        </div>
      ) : (
        <div className="relative w-full min-h-[350px] bg-[#050505] flex items-center justify-center">
          
          {/* The actual video feed container */}
          <div id="keep-secure-optics-viewport" className="w-full h-full absolute inset-0 [&>video]:object-cover" />
          
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