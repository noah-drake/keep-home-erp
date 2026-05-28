'use client'

import { useEffect, useRef } from 'react'

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void
  onScanFailure?: (error: string) => void
  paused?: boolean // Left for interface compatibility, but we are no longer letting it control the hardware
}

export default function BarcodeScanner({ onScanSuccess, onScanFailure }: BarcodeScannerProps) {
  const scannerRef = useRef<any>(null)
  const scanCountRef = useRef(0)
  const isMounted = useRef(false)
  const onScanSuccessRef = useRef(onScanSuccess)

  // Keep success reference fresh for the debounce timeout
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess
  }, [onScanSuccess])

  useEffect(() => {
    if (isMounted.current) return
    isMounted.current = true

    let scannerInstance: any = null

    // Dynamically import to protect the Next.js server
    import('html5-qrcode').then((module) => {
      const Html5QrcodeScanner = module.Html5QrcodeScanner

      scannerInstance = new Html5QrcodeScanner(
        'barcode-scanner',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
        },
        false // Verbose logging disabled
      )
      
      scannerRef.current = scannerInstance

      scannerInstance.render(
        (decodedText: string) => {
          scanCountRef.current += 1
          const currentScan = scanCountRef.current
          
          setTimeout(() => {
            if (scanCountRef.current === currentScan) {
              onScanSuccessRef.current(decodedText)
            }
          }, 500)
        },
        (errorMessage: string) => {
          // We ignore routine scan failures (like "No barcode found in frame")
          if (onScanFailure) onScanFailure(errorMessage)
        }
      )

      // Inject custom dark theme
      const styleId = 'barcode-scanner-dark-theme'
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style')
        style.id = styleId
        style.textContent = `
          #barcode-scanner { background: #0a0a0a !important; border-radius: 16px; overflow: hidden; border: 1px solid #333; }
          #barcode-scanner video { object-fit: cover; border-radius: 12px; }
          #barcode-scanner__scan_region { background: #0a0a0a !important; }
          #barcode-scanner__dashboard_section_csr span, #barcode-scanner__dashboard_section_swaplink { color: #a855f7 !important; }
          #barcode-scanner__dashboard { background: #0a0a0a !important; color: #e5e5e5 !important; border-radius: 12px; padding: 16px; }
          #barcode-scanner__dashboard_section_csr button { background: #7c3aed !important; color: white !important; border-radius: 8px; padding: 8px 16px; font-weight: bold; border: none; margin-top: 10px; }
          #barcode-scanner__dashboard_section_csr button:hover { background: #8b5cf6 !important; }
          #barcode-scanner__dashboard_section_swaplink a { color: #a855f7 !important; }
        `
        document.head.appendChild(style)
      }
    }).catch(err => {
      console.error("Failed to load html5-qrcode module", err)
    })

    return () => {
      // Gracefully clear the hardware when navigating away
      if (scannerInstance) {
        scannerInstance.clear().catch((error: any) => console.error('Failed to clear scanner:', error))
      }
      isMounted.current = false
    }
  }, [])

  // NOTE: The broken pause/resume useEffect has been completely eradicated.

  return (
    <div className="w-full max-w-lg mx-auto bg-black rounded-2xl overflow-hidden border border-gray-800 p-2 shadow-2xl">
      <div id="barcode-scanner" className="w-full min-h-[300px] flex items-center justify-center text-gray-500 text-xs font-bold uppercase tracking-widest" />
    </div>
  )
}