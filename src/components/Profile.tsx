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
  requestTokenDrop,
} from '@/lib/contracts'

export function Profile() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()
  const {
    data: ethBalance,
  } = useBalance({
    address: address || undefined,
  })

  const [tokenBalance, setTokenBalance] = useState<bigint>(BigInt(0))
  const [tokenDecimals, setTokenDecimals] = useState<number>(18)
  const [tokenSymbol, setTokenSymbol] = useState<string>('MTK')
  const [nftBalance, setNftBalance] = useState<bigint>(BigInt(0))
  const [isLoading, setIsLoading] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  
  const [isTransferring, setIsTransferring] = useState(false)
  const [transferStatus, setTransferStatus] = useState<string>('')

  const [isRequesting, setIsRequesting] = useState(false)
  const [requestMsg, setRequestMsg] = useState<string>('')

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchNFTBalance = async () => {
    if (!isConnected || !address) return
    try {
      const balance = await balanceOf(address)
      setNftBalance(balance)
    } catch (error) {
      console.error('NFT 잔액 조회 오류:', error)
    }
  }

  const fetchTokenInfo = async () => {
    if (!isConnected || !address) return
    try {
      const [decimals, symbol, balance] = await Promise.all([
        getTokenDecimals(),
        getTokenSymbol(),
        getTokenBalance(address).catch(() => BigInt(0)),
      ])
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

  const handleRequestTokens = async () => {
    if (!isConnected || !address) return alert('지갑을 연결해주세요.')
    setIsRequesting(true)
    setRequestMsg('')
    try {
      setRequestMsg('토큰 신청 트랜잭션 진행 중...')
      await requestTokenDrop()
      setRequestMsg(`✅ 1000 ${tokenSymbol} 지급 완료!`)
      await fetchTokenInfo()
    } catch (error: any) {
      const msg = error?.shortMessage || error?.message || ''
      if (String(msg).includes('Already received')) {
        setRequestMsg('⚠️ 이미 토큰을 받았습니다.')
      } else {
        setRequestMsg(`⚠️ 신청 실패: ${msg}`)
      }
    } finally {
      setIsRequesting(false)
    }
  }

  if (!mounted) {
    return (
      <div className='p-8 bg-white/50 backdrop-blur-md rounded-2xl flex items-center justify-center animate-pulse'>
        <p className='text-emerald-500 font-medium'>로딩 중...</p>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className='p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3'>
        <div className='p-2 bg-emerald-100 rounded-full text-emerald-600'>⚠️</div>
        <p className='text-emerald-800 font-medium'>프로필을 보려면 먼저 지갑을 연결해주세요.</p>
      </div>
    )
  }

  const getEtherscanUrl = (address: string) => `https://sepolia.etherscan.io/address/${address}`

  const copyToClipboard = (text: string) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      alert('주소가 복사되었습니다!')
    }
  }

  interface StatCardProps {
    title: string
    value: string
    subValue?: string
    icon: string
    colorClass: string
    action?: React.ReactNode
  }

  const StatCard = ({ title, value, subValue, icon, colorClass, action }: StatCardProps) => (
    <div className='relative overflow-hidden bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-emerald-50 shadow-lg group hover:-translate-y-1 transition-all duration-300'>
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${colorClass}`}>
        <span className="text-6xl">{icon}</span>
      </div>
      <div>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">{title}</p>
        <div className="flex items-baseline gap-2">
           <h3 className="text-3xl font-black text-slate-800">{value}</h3>
           {subValue && <span className="text-sm font-semibold text-slate-400">{subValue}</span>}
        </div>
      </div>
      {action && <div className="mt-6 border-t border-slate-100 pt-4">{action}</div>}
    </div>
  )

  return (
    <div className='space-y-8 animate-fadeIn'>
      {/* Profile Header */}
      <div className='relative overflow-hidden bg-gradient-to-r from-emerald-900 to-teal-800 rounded-3xl p-8 shadow-2xl text-white'>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
           <div>
             <h2 className='text-3xl font-bold mb-2'>내 지갑</h2>
             <div className='flex items-center gap-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10'>
                <code className='font-mono text-sm text-emerald-100'>
                  {address}
                </code>
                <button
                  onClick={() => copyToClipboard(address || '')}
                  className='p-1.5 hover:bg-white/20 rounded-lg transition-colors'
                  title="복사"
                >
                  📋
                </button>
                <a
                  href={getEtherscanUrl(address || '')}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='p-1.5 hover:bg-white/20 rounded-lg transition-colors'
                  title="Etherscan"
                >
                  🔗
                </a>
             </div>
           </div>
           
           <button
              onClick={() => {
                fetchTokenInfo()
                fetchNFTBalance()
              }}
              disabled={isLoading}
              className='px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm font-semibold transition-all backdrop-blur-sm'
            >
              🔄 {isLoading ? '갱신 중...' : '새로고침'}
            </button>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
         <StatCard
           title="ETH Balance"
           value={ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : "0.0000"}
           subValue="ETH"
           icon="Ξ"
           colorClass="text-slate-900"
         />

         <StatCard
           title={`${tokenSymbol} Balance`}
           value={formatTokenAmount(tokenBalance, tokenDecimals)}
           subValue={tokenSymbol}
           icon="🪙"
           colorClass="text-amber-500"
           action={
             <div className="flex gap-2">
                {tokenBalance > BigInt(0) && (
                  <button
                    onClick={() => setShowTransferModal(true)}
                    className='flex-1 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold transition-colors'
                  >
                    전송
                  </button>
                )}
                <button
                  onClick={handleRequestTokens}
                  disabled={isRequesting}
                  className='flex-1 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50'
                >
                  {isRequesting ? '신청 중...' : 'Faucet'}
                </button>
             </div>
           }
         />

         <StatCard
           title="My NFTs"
           value={nftBalance.toString()}
           subValue="Items"
           icon="🎨"
           colorClass="text-purple-500"
           action={
             <div className="text-xs text-slate-400 font-medium">
               보유 중인 NFT 컬렉션 수량입니다.
             </div>
           }
         />
      </div>

      {requestMsg && (
        <div className={`p-4 rounded-xl shadow-sm text-sm font-bold text-center animate-fadeIn ${
           requestMsg.includes('✅') 
             ? 'bg-green-50 text-green-700 border border-green-100'
             : 'bg-amber-50 text-amber-700 border border-amber-100'
        }`}>
          {requestMsg}
        </div>
      )}

      {/* 토큰 전송 모달 */}
      {showTransferModal && (
        <TokenTransferModal
          tokenBalance={tokenBalance}
          tokenDecimals={tokenDecimals}
          tokenSymbol={tokenSymbol}
          onClose={() => {
            setShowTransferModal(false)
            setTransferStatus('')
          }}
          onTransfer={async (to: string, amount: string) => {
            if (!isConnected || !address) return alert('지갑을 연결해주세요.')
            setIsTransferring(true)
            setTransferStatus('')
            try {
              if (!to.startsWith('0x') || to.length !== 42) throw new Error('올바른 지갑 주소 형식이 아닙니다.')
              const amountInWei = parseTokenAmount(amount, tokenDecimals)
              if (amountInWei > tokenBalance) throw new Error('잔액이 부족합니다.')
              if (amountInWei <= BigInt(0)) throw new Error('0보다 큰 금액을 입력해주세요.')

              setTransferStatus('토큰 전송 중...')
              const receipt = await transferToken(to as `0x${string}`, amountInWei)

              setTransferStatus(`전송 완료! 트랜잭션: ${receipt.transactionHash}`)
              await fetchTokenInfo()
              setTimeout(() => {
                setShowTransferModal(false)
                setTransferStatus('')
              }, 3000)
            } catch (error: any) {
              setTransferStatus(`전송 실패: ${error.message || '알 수 없는 오류'}`)
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

function TokenTransferModal({
  tokenBalance,
  tokenDecimals,
  tokenSymbol,
  onClose,
  onTransfer,
  isTransferring,
  transferStatus,
}: any) {
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (to && amount) onTransfer(to, amount)
  }

  const handleMax = () => setAmount(formatTokenAmount(tokenBalance, tokenDecimals))

  return (
    <div className='fixed inset-0 bg-emerald-950/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn'>
      <div className='bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4'>
        <div className='flex justify-between items-center mb-6'>
          <h3 className='text-2xl font-bold text-slate-800'>토큰 전송</h3>
          <button onClick={onClose} className='p-2 rounded-full hover:bg-slate-100'>✕</button>
        </div>

        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className="group">
            <label className='block text-sm font-bold text-slate-700 mb-2'>받는 주소</label>
            <input
              type='text'
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder='0x...'
              className='w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-sm outline-none transition-all'
              required
              disabled={isTransferring}
            />
          </div>

          <div className="group">
            <label className='block text-sm font-bold text-slate-700 mb-2'>
              전송할 금액 ({tokenSymbol})
            </label>
            <div className='flex gap-2'>
              <input
                type='number'
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder='0.0'
                className='flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all'
                required
                disabled={isTransferring}
              />
              <button
                type='button'
                onClick={handleMax}
                className='px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200'
                disabled={isTransferring}
              >
                최대
              </button>
            </div>
          </div>

          <button
            type='submit'
            disabled={isTransferring || !to || !amount}
            className='w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all disabled:opacity-50 disabled:transform-none'
          >
            {isTransferring ? '전송 중...' : '전송하기'}
          </button>
          
          {transferStatus && (
            <div className={`p-4 rounded-xl text-sm font-semibold text-center whitespace-pre-wrap ${
              transferStatus.includes('완료') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {transferStatus}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
