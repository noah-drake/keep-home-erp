'use client'

import { useEffect, useRef, useState } from 'react'

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void
  onScanFailure?: (error: string) => void
  paused?: boolean
}

export default function BarcodeScanner({ onScanSuccess, onScanFailure, paused = false }: BarcodeScannerProps) {
  const scannerRef = useRef<any>(null)
  const scanCountRef = useRef(0)
  const isMounted = useRef(false)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  // Dynamically load the external script to prevent build resolution errors
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).Html5QrcodeScanner) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
      script.async = true
      script.onload = () => setScriptLoaded(true)
      document.body.appendChild(script)
    } else {
      setScriptLoaded(true)
    }
  }, [])

  useEffect(() => {
    // IRON GATE: Prevents React Strict Mode from double-mounting the camera
    if (!scriptLoaded || isMounted.current) return
    isMounted.current = true

    const Html5QrcodeScanner = (window as any).Html5QrcodeScanner

    if (!Html5QrcodeScanner) return

    const scanner = new Html5QrcodeScanner(
      'barcode-scanner',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
      },
      false // Verbose logging disabled
    )
    
    scannerRef.current = scanner

    scanner.render(
      (decodedText: string) => {
        // Debounce scans to prevent rapid-fire database calls
        scanCountRef.current += 1
        const currentScan = scanCountRef.current
        
        setTimeout(() => {
          if (scanCountRef.current === currentScan) {
            onScanSuccess(decodedText)
          }
        }, 500)
      },
      (errorMessage: string) => {
        if (onScanFailure) {
          onScanFailure(errorMessage)
        }
      }
    )

    // Custom dark theme styling for the injected HTML elements
    const styleId = 'barcode-scanner-dark-theme'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        #barcode-scanner {
          background: #0a0a0a !important;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #333;
        }
        #barcode-scanner video {
          object-fit: cover;
          border-radius: 12px;
        }
        #barcode-scanner__scan_region {
          background: #0a0a0a !important;
        }
        #barcode-scanner__dashboard_section_csr span,
        #barcode-scanner__dashboard_section_swaplink {
          color: #a855f7 !important;
        }
        #barcode-scanner__dashboard {
          background: #0a0a0a !important;
          color: #e5e5e5 !important;
          border-radius: 12px;
          padding: 16px;
        }
        #barcode-scanner__dashboard_section_csr button {
          background: #7c3aed !important;
          color: white !important;
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: bold;
          border: none;
          margin-top: 10px;
        }
        #barcode-scanner__dashboard_section_csr button:hover {
          background: #8b5cf6 !important;
        }
        #barcode-scanner__dashboard_section_swaplink a {
          color: #a855f7 !important;
        }
      `
      document.head.appendChild(style)
    }

    return () => {
      // Proper cleanup to release the camera hardware
      if (scannerRef.current) {
        scannerRef.current.clear().catch((error: any) => {
          console.error('Failed to clear scanner:', error)
        })
        scannerRef.current = null
      }
      isMounted.current = false
    }
  }, [onScanFailure, onScanSuccess, scriptLoaded])

  // Handle Play/Pause state driven by the parent component
  useEffect(() => {
    if (scannerRef.current) {
      if (paused) {
        scannerRef.current.pause(true) // true = also freeze the video feed
      } else {
        scannerRef.current.resume()
      }
    }
  }, [paused])

  return (
    <div className="w-full max-w-lg mx-auto bg-black rounded-2xl overflow-hidden border border-gray-800 p-2 shadow-2xl">
      {/* html5-qrcode forces itself into this exact ID */}
      <div id="barcode-scanner" className="w-full" />
    </div>
  )
}