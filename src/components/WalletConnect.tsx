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

  // 클라이언트에서만 마운트되도록 처리
  useEffect(() => {
    setMounted(true)
  }, [])

  // 서버 사이드 렌더링 시 빈 div 반환
  if (!mounted) {
    return (
      <div className='flex items-center gap-4'>
        <div className='px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg'>
          <span className='text-sm'>로딩 중...</span>
        </div>
      </div>
    )
  }

  const isSepolia = chainId === SEPOLIA_CHAIN_ID

  const handleSwitchChain = () => {
    switchChain({ chainId: SEPOLIA_CHAIN_ID })
  }

  if (isConnected) {
    return (
      <div className='flex items-center gap-4'>
        {!isSepolia && (
          <button
            onClick={handleSwitchChain}
            className='px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors'
          >
            Sepolia로 전환
          </button>
        )}
        <div className='px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg'>
          <span className='text-sm font-mono'>
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className='px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors'
        >
          연결 해제
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
          className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50'
        >
          {isPending ? '연결 중...' : `${connector.name} 연결`}
        </button>
      ))}
    </div>
  )
}
