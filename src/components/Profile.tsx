'use client'

import { formatEther } from 'viem'
import { useState, useEffect } from 'react'
import { useAccount, useBalance } from 'wagmi'
import {
  getTokenBalance,
  getTokenDecimals,
  getTokenSymbol,
  formatTokenAmount,
  parseTokenAmount,
  transferToken,
  balanceOf,
} from '@/lib/contracts'

export function Profile() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()
  const {
    data: ethBalance,
    isLoading: ethBalanceLoading,
    error: ethBalanceError,
  } = useBalance({
    address: address || undefined,
  })

  const [tokenBalance, setTokenBalance] = useState<bigint>(BigInt(0))
  const [tokenDecimals, setTokenDecimals] = useState<number>(18)
  const [tokenSymbol, setTokenSymbol] = useState<string>('MTK')
  const [nftBalance, setNftBalance] = useState<bigint>(BigInt(0))
  const [isLoading, setIsLoading] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [isTransferring, setIsTransferring] = useState(false)
  const [transferStatus, setTransferStatus] = useState<string>('')

  // 클라이언트에서만 마운트되도록 처리
  useEffect(() => {
    setMounted(true)
  }, [])

  // NFT 잔액 조회
  const fetchNFTBalance = async () => {
    if (!isConnected || !address) return

    try {
      const balance = await balanceOf(address)
      setNftBalance(balance)
    } catch (error) {
      console.error('NFT 잔액 조회 오류:', error)
    }
  }

  // 토큰 정보 및 잔액 조회
  const fetchTokenInfo = async () => {
    if (!isConnected || !address) {
      console.log('토큰 정보 조회: 지갑이 연결되지 않음')
      return
    }

    console.log('토큰 정보 조회 시작:', address)

    try {
      const [decimals, symbol, balance] = await Promise.all([
        getTokenDecimals(),
        getTokenSymbol(),
        getTokenBalance(address).catch((err) => {
          console.error('토큰 잔액 조회 실패:', err)
          return BigInt(0)
        }),
      ])

      console.log('토큰 정보 조회 완료:', {
        decimals,
        symbol,
        balance: balance.toString(),
      })

      setTokenDecimals(decimals)
      setTokenSymbol(symbol)
      setTokenBalance(balance)
    } catch (error: any) {
      console.error('토큰 정보 조회 오류:', error)
    }
  }

  useEffect(() => {
    if (mounted && isConnected) {
      fetchTokenInfo()
      fetchNFTBalance()
    }
  }, [mounted, isConnected, address])

  // 서버 사이드 렌더링 시 로딩 표시
  if (!mounted) {
    return (
      <div className='p-4 bg-gray-50 dark:bg-gray-800 rounded-lg'>
        <p className='text-gray-600 dark:text-gray-400'>로딩 중...</p>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className='p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg'>
        <p className='text-yellow-800 dark:text-yellow-200'>
          프로필을 보려면 먼저 지갑을 연결해주세요.
        </p>
      </div>
    )
  }

  const getEtherscanUrl = (address: string) => {
    return `https://sepolia.etherscan.io/address/${address}`
  }

  const copyToClipboard = (text: string) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      alert('주소가 클립보드에 복사되었습니다!')
    }
  }

  return (
    <div className='space-y-6'>
      {/* 프로필 요약 */}
      <div className='p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg'>
        <h2 className='text-2xl font-bold mb-6'>내 프로필</h2>

        <div className='space-y-4'>
          {/* 지갑 주소 */}
          <div>
            <label className='block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2'>
              지갑 주소
            </label>
            <div className='flex items-center gap-2'>
              <code className='text-sm font-mono bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded flex-1'>
                {address}
              </code>
              <button
                onClick={() => copyToClipboard(address || '')}
                className='px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm'
              >
                복사
              </button>
              <a
                href={getEtherscanUrl(address || '')}
                target='_blank'
                rel='noopener noreferrer'
                className='px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm'
              >
                Etherscan ↗
              </a>
            </div>
          </div>

          {/* 잔액 정보 */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            {/* ETH 잔액 */}
            <div className='p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
              <p className='text-sm text-gray-600 dark:text-gray-400 mb-1'>
                ETH 잔액
              </p>
              {ethBalanceLoading ? (
                <p className='text-xl font-bold text-blue-800 dark:text-blue-200'>
                  로딩 중...
                </p>
              ) : ethBalanceError ? (
                <p className='text-xl font-bold text-red-800 dark:text-red-200'>
                  조회 실패
                </p>
              ) : ethBalance ? (
                <p className='text-xl font-bold text-blue-800 dark:text-blue-200'>
                  {parseFloat(formatEther(ethBalance.value)).toFixed(4)} ETH
                </p>
              ) : (
                <p className='text-xl font-bold text-blue-800 dark:text-blue-200'>
                  0.0000 ETH
                </p>
              )}
            </div>

            {/* 토큰 잔액 */}
            <div className='p-4 bg-green-50 dark:bg-green-900/20 rounded-lg'>
              <p className='text-sm text-gray-600 dark:text-gray-400 mb-1'>
                {tokenSymbol} 토큰 잔액
              </p>
              <p className='text-xl font-bold text-green-800 dark:text-green-200'>
                {formatTokenAmount(tokenBalance, tokenDecimals)} {tokenSymbol}
              </p>
              {tokenBalance > BigInt(0) && (
                <button
                  onClick={() => setShowTransferModal(true)}
                  className='mt-2 w-full px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs'
                >
                  전송
                </button>
              )}
            </div>

            {/* NFT 잔액 */}
            <div className='p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg'>
              <p className='text-sm text-gray-600 dark:text-gray-400 mb-1'>
                보유 NFT
              </p>
              <p className='text-xl font-bold text-purple-800 dark:text-purple-200'>
                {nftBalance.toString()}개
              </p>
            </div>
          </div>

          {/* 새로고침 버튼 */}
          <div className='mt-4'>
            <button
              onClick={() => {
                fetchTokenInfo()
                fetchNFTBalance()
              }}
              disabled={isLoading}
              className='px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50'
            >
              {isLoading ? '로딩 중...' : '새로고침'}
            </button>
          </div>
        </div>
      </div>

      {/* 토큰 전송 모달 */}
      {showTransferModal && (
        <TokenTransferModal
          tokenBalance={tokenBalance}
          tokenDecimals={tokenDecimals}
          tokenSymbol={tokenSymbol}
          onClose={() => {
            setShowTransferModal(false)
            setTransferTo('')
            setTransferAmount('')
            setTransferStatus('')
          }}
          onTransfer={async (to: string, amount: string) => {
            if (!isConnected || !address) {
              alert('지갑을 연결해주세요.')
              return
            }

            setIsTransferring(true)
            setTransferStatus('')

            try {
              // 주소 유효성 검사
              if (!to.startsWith('0x') || to.length !== 42) {
                throw new Error('올바른 지갑 주소를 입력해주세요.')
              }

              // 금액 검사
              const amountInWei = parseTokenAmount(amount, tokenDecimals)
              if (amountInWei > tokenBalance) {
                throw new Error('잔액이 부족합니다.')
              }

              if (amountInWei <= BigInt(0)) {
                throw new Error('0보다 큰 금액을 입력해주세요.')
              }

              setTransferStatus('토큰 전송 중...')
              const receipt = await transferToken(
                to as `0x${string}`,
                amountInWei
              )

              setTransferStatus(
                `전송 완료! 트랜잭션: ${receipt.transactionHash}`
              )

              // 잔액 새로고침
              await fetchTokenInfo()

              // 3초 후 모달 닫기
              setTimeout(() => {
                setShowTransferModal(false)
                setTransferTo('')
                setTransferAmount('')
                setTransferStatus('')
              }, 3000)
            } catch (error: any) {
              console.error('토큰 전송 오류:', error)
              setTransferStatus(
                `전송 실패: ${error.message || '알 수 없는 오류'}`
              )
            } finally {
              setIsTransferring(false)
            }
          }}
          isTransferring={isTransferring}
          transferStatus={transferStatus}
        />
      )}
    </div>
  )
}

// 토큰 전송 모달 컴포넌트
function TokenTransferModal({
  tokenBalance,
  tokenDecimals,
  tokenSymbol,
  onClose,
  onTransfer,
  isTransferring,
  transferStatus,
}: {
  tokenBalance: bigint
  tokenDecimals: number
  tokenSymbol: string
  onClose: () => void
  onTransfer: (to: string, amount: string) => Promise<void>
  isTransferring: boolean
  transferStatus: string
}) {
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (to && amount) {
      onTransfer(to, amount)
    }
  }

  const handleMax = () => {
    setAmount(formatTokenAmount(tokenBalance, tokenDecimals))
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4'>
        <div className='flex justify-between items-center mb-4'>
          <h3 className='text-xl font-bold'>토큰 전송</h3>
          <button
            onClick={onClose}
            className='text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label className='block text-sm font-medium mb-2'>받는 주소</label>
            <input
              type='text'
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder='0x...'
              className='w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-mono text-sm'
              required
              disabled={isTransferring}
            />
          </div>

          <div>
            <label className='block text-sm font-medium mb-2'>
              전송할 금액 ({tokenSymbol})
            </label>
            <div className='flex gap-2'>
              <input
                type='number'
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder='0.0'
                step='0.000000000000000001'
                min='0'
                max={formatTokenAmount(tokenBalance, tokenDecimals)}
                className='flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600'
                required
                disabled={isTransferring}
              />
              <button
                type='button'
                onClick={handleMax}
                className='px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm'
                disabled={isTransferring}
              >
                최대
              </button>
            </div>
            <p className='text-xs text-gray-500 mt-1'>
              사용 가능: {formatTokenAmount(tokenBalance, tokenDecimals)}{' '}
              {tokenSymbol}
            </p>
          </div>

          {transferStatus && (
            <div
              className={`p-3 rounded-lg ${
                transferStatus.includes('완료')
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                  : transferStatus.includes('실패')
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                  : 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200'
              }`}
            >
              <p className='text-sm'>{transferStatus}</p>
            </div>
          )}

          <div className='flex gap-2'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600'
              disabled={isTransferring}
            >
              취소
            </button>
            <button
              type='submit'
              disabled={isTransferring || !to || !amount}
              className='flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isTransferring ? '전송 중...' : '전송'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
