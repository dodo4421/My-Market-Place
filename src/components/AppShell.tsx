'use client'

import { ReactNode } from 'react'
import { BGJBadge } from './ui/BGJBadge'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* Top bar (Glassmorphism Header) */}
      <div className="sticky top-0 z-50 border-b border-emerald-100 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo Area */}
            <div className="relative group cursor-pointer">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
              <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black shadow-lg">
                <span className="text-xl tracking-tighter">My</span>
              </div>
            </div>
            
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight">
                Premium Market
              </h1>
              <p className="text-xs text-emerald-600 font-medium tracking-wide">
                WEB3 NFT PLAYGROUND
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <BGJBadge tone="success" className="shadow-sm border-emerald-100 bg-emerald-50 text-emerald-700">Sepolia Network</BGJBadge>
          </div>
        </div>
      </div>

      {/* Page container */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {children}
      </main>
    </div>
  )
}
