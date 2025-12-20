'use client'

import { useState, useEffect } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
} from 'wagmi'
import { SEPOLIA_CHAIN_ID } from '@/lib/constants'

export function WalletConnect() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className='flex items-center gap-4'>
        <div className='px-5 py-2.5 bg-emerald-50 rounded-xl animate-pulse w-32 h-10'></div>
      </div>
    )
  }

  const isSepolia = chainId === SEPOLIA_CHAIN_ID

  const handleSwitchChain = () => {
    switchChain({ chainId: SEPOLIA_CHAIN_ID })
  }

  if (isConnected) {
    return (
      <div className='flex items-center gap-3 animate-fadeIn'>
        {!isSepolia && (
          <button
            onClick={handleSwitchChain}
            className='px-4 py-2 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors shadow-md hover:shadow-lg transform active:scale-95'
          >
            ⚠️ Sepolia 전환
          </button>
        )}
        <div className='px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2'>
          <div className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse'></div>
          <span className='text-sm font-bold text-emerald-900 font-mono'>
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className='px-4 py-2 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors'
        >
          해제
        </button>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-2'>
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          disabled={isPending}
          className='px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:from-emerald-600 hover:to-teal-600 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'
        >
          {isPending ? (
             <span className="flex items-center gap-2">
               <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
               연결 중...
             </span>
          ) : (
            `${connector.name} 연결`
          )}
        </button>
      ))}
    </div>
  )
}
