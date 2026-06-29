'use client'
import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Optional custom fallback; receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render/lifecycle errors in its subtree and shows a recoverable fallback instead of
 * unmounting the whole app. Wrap volatile regions (e.g. the barcode scanner) or the main
 * content area so one component's failure stays contained.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface to the console for now; swap for a real reporter (Sentry, etc.) later.
    console.error('Uncaught error in component tree:', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="bg-[#0f0f0f] border border-red-900/40 rounded-[2rem] p-8 max-w-md w-full text-center shadow-xl">
          <p className="text-[9px] font-black uppercase tracking-widest text-red-500 mb-2">Something Broke</p>
          <h2 className="text-xl font-black uppercase tracking-tight text-gray-200 mb-3">This panel hit an error</h2>
          <p className="text-xs text-gray-500 font-medium mb-6 leading-relaxed break-words">
            {error.message || 'An unexpected error occurred.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={this.reset}
              className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest text-white transition-all active:scale-95"
            >
              Try Again
            </button>
            <button
              onClick={() => { window.location.href = '/' }}
              className="bg-black border border-gray-800 hover:border-gray-600 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest text-gray-300 transition-all active:scale-95"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }
}
