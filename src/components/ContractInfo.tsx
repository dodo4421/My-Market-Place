'use client'

import { formatEther } from 'viem'
import { useState, useEffect } from 'react'
import { useAccount, useBalance } from 'wagmi'
import { nftContractAddress, marketplaceContractAddress } from '@/lib/constants'
import {
  requestTokenDrop,
  getTokenSymbol,
  getTokenDecimals,
  getTokenBalance,
  formatTokenAmount,
} from '@/lib/contracts'

export function ContractInfo() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()
  const {
    data: ethBalance,
    isLoading: ethLoading,
    error: ethError,
  } = useBalance({
    address: address || undefined,
  })

  // Faucet Status
  const [isRequesting, setIsRequesting] = useState(false)
  const [requestMsg, setRequestMsg] = useState<string>('')

  // Token Info
  const [tokenSymbol, setTokenSymbol] = useState<string>('MTK')
  const [tokenDecimals, setTokenDecimals] = useState<number>(18)
  const [userTokenBalance, setUserTokenBalance] = useState<bigint>(BigInt(0))

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchTokenData = async () => {
    if (isConnected && address) {
      try {
        const symbol = await getTokenSymbol()
        const decimals = await getTokenDecimals()
        const balance = await getTokenBalance(address)
        setTokenSymbol(symbol)
        setTokenDecimals(decimals)
        setUserTokenBalance(balance)
      } catch (e) {
        console.error('토큰 정보 로드 실패', e)
      }
    }
  }

  useEffect(() => {
    if (mounted && isConnected) {
      fetchTokenData()
    }
  }, [mounted, isConnected, address])

  const copyToClipboard = (text: string) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      alert('주소가 복사되었습니다!')
    }
  }

  const handleRequestTokens = async () => {
    if (!isConnected || !address) {
      alert('지갑을 연결해주세요.')
      return
    }
    setIsRequesting(true)
    setRequestMsg('')
    try {
      setRequestMsg('토큰 신청 트랜잭션 진행 중...')
      const receipt = await requestTokenDrop()
      setRequestMsg(`✅ 1000 ${tokenSymbol} 지급 완료!`)
      await fetchTokenData()
    } catch (error: any) {
      console.error('토큰 신청 오류:', error)
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
        <p className='text-emerald-600 font-medium'>로딩 중...</p>
      </div>
    )
  }

  return (
    <div className='bg-white/80 backdrop-blur-md rounded-3xl shadow-xl p-8 border border-emerald-50'>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
         <h2 className='text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-lime-600'>
           컨트랙트 정보
         </h2>
         {isConnected && (
            <div className="px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
               <span className="text-emerald-700 font-bold text-sm">Network Active</span>
            </div>
         )}
      </div>

      <div className='space-y-6'>
        {/* NFT Contract */}
        <ContractRow
          label="NFT 컨트랙트"
          address={nftContractAddress}
          onCopy={() => copyToClipboard(nftContractAddress)}
        />

        {/* Marketplace Contract */}
        <ContractRow
          label="마켓플레이스"
          address={marketplaceContractAddress}
          onCopy={() => copyToClipboard(marketplaceContractAddress)}
        />
      </div>

      {/* Faucet Section */}
      <div className='mt-10 p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100'>
        <h3 className='text-xl font-bold text-emerald-800 mb-2'>🌱 토큰 수도꼭지 (Faucet)</h3>
        <p className='text-emerald-600 text-sm mb-6'>
          테스트용 MTK 토큰을 무료로 받아가세요. (1회 한정)
        </p>

        <div className='flex flex-col sm:flex-row items-center gap-4'>
           <div className="flex-1 w-full p-4 bg-white rounded-xl shadow-sm border border-emerald-100/50">
              <p className="text-xs text-emerald-500 font-bold uppercase mb-1">Current Balance</p>
              <p className="text-2xl font-black text-emerald-900">
                {formatTokenAmount(userTokenBalance, tokenDecimals)} {tokenSymbol}
              </p>
           </div>
           
           <button
             onClick={handleRequestTokens}
             disabled={isRequesting}
             className='w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl shadow-lg hover:shadow-emerald-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
           >
             {isRequesting ? (
               <span className="flex items-center gap-2">
                 <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 요청 중...
               </span>
             ) : (
               <>
                 <span>토큰 받기</span>
                 <span className="bg-white/20 px-2 py-0.5 rounded text-xs">1000 MTK</span>
               </>
             )}
           </button>
        </div>

        {requestMsg && (
          <div className={`mt-4 p-3 rounded-xl text-sm font-bold border ${
             requestMsg.includes('✅') 
               ? 'bg-green-100 border-green-200 text-green-800'
               : requestMsg.includes('실패') || requestMsg.includes('오류')
               ? 'bg-red-50 border-red-100 text-red-600'
               : 'bg-emerald-100 border-emerald-200 text-emerald-800'
          }`}>
             {requestMsg}
          </div>
        )}
      </div>
    </div>
  )
}

function ContractRow({ label, address, onCopy }: { label: string, address: string, onCopy: () => void }) {
  return (
    <div className='group p-4 rounded-xl hover:bg-emerald-50/50 transition-colors border border-transparent hover:border-emerald-100'>
      <p className='text-sm font-bold text-slate-500 mb-1'>{label}</p>
      <div className='flex items-center gap-3'>
        <code className='text-sm font-mono text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex-1 break-all group-hover:bg-white transition-colors'>
          {address}
        </code>
        <div className="flex shrink-0 gap-2">
          <CopyButton onClick={onCopy} />
          <EtherscanButton address={address} />
        </div>
      </div>
    </div>
  )
}

function CopyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className='p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all'
      title="주소 복사"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
    </button>
  )
}

function EtherscanButton({ address }: { address: string }) {
  return (
    <a
      href={`https://sepolia.etherscan.io/address/${address}`}
      target='_blank'
      rel='noopener noreferrer'
      className='p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all'
      title="Etherscan에서 보기"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
    </a>
  )
}
