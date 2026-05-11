'use client'

import { useEffect, useRef } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void
  onScanFailure?: (error: string) => void
  paused?: boolean
}

export default function BarcodeScanner({ onScanSuccess, onScanFailure, paused = false }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const scanCountRef = useRef(0)

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'barcode-scanner',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      false
    )
    
    scannerRef.current = scanner

    scanner.render(
      (decodedText: string) => {
        // Debounce scans to prevent multiple rapid detections
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

    // Custom dark theme styling
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
      // Proper cleanup to prevent memory leaks
      if (scannerRef.current) {
        scannerRef.current.clear().catch((error) => {
          console.error('Failed to clear scanner:', error)
        })
        scannerRef.current = null
      }
    }
  }, [])

  // Handle pause/resume
  useEffect(() => {
    if (scannerRef.current) {
      if (paused) {
        scannerRef.current.pause()
      } else {
        scannerRef.current.resume()
      }
    }
  }, [paused])

  return (
    <div className="w-full max-w-lg mx-auto">
      <div id="barcode-scanner" className="w-full" />
    </div>
  )
}
