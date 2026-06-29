'use client'

/**
 * Root-level error boundary. Next.js renders this (replacing the entire app, including the
 * root layout) when an error escapes everything else — which is exactly the "Application
 * error: a client-side exception has occurred" case. Unlike the generic message, this shows
 * the real error text and digest so a production crash is actually diagnosable.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 520, width: '100%', background: '#0f0f0f', border: '1px solid rgba(127,29,29,0.5)', borderRadius: 24, padding: 32, textAlign: 'center' }}>
            <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', color: '#ef4444', margin: '0 0 8px' }}>
              Application Error
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 900, textTransform: 'uppercase', letterSpacing: -0.5, color: '#e5e7eb', margin: '0 0 16px' }}>
              The app crashed while loading
            </h2>
            <pre style={{ fontSize: 12, color: '#9ca3af', background: '#000', border: '1px solid #1f2937', borderRadius: 12, padding: 16, textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0 0 8px' }}>
              {error?.message || 'Unknown error'}
            </pre>
            {error?.digest && (
              <p style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace', margin: '0 0 24px' }}>
                digest: {error.digest}
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
              <button
                onClick={() => reset()}
                style={{ background: '#9333ea', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 900, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Try Again
              </button>
              <button
                onClick={() => { window.location.href = '/' }}
                style={{ background: '#000', color: '#d1d5db', border: '1px solid #1f2937', padding: '12px 24px', borderRadius: 12, fontWeight: 900, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
