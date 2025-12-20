'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import {
  getListing,
  buyNFT,
  cancelListing,
  approveToken,
  getTokenBalance,
  getTokenAllowance,
  getTokenDecimals,
  getTokenSymbol,
  formatTokenAmount,
  ownerOf,
  getTokenURI,
} from '@/lib/contracts'
import {
  marketplaceContractAddress,
  nftContractAddress,
} from '@/lib/constants'
import { getIPFSGatewayUrl } from '@/lib/ipfs'

interface NFTListing {
  tokenId: bigint
  price: bigint
  seller: `0x${string}`
  isListed: boolean
  image?: string
  name?: string
}

export function Marketplace() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()

  const [listings, setListings] = useState<NFTListing[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [selectedNFT, setSelectedNFT] = useState<NFTListing | null>(null)
  const [nftDetails, setNftDetails] = useState<{
    description?: string
    attributes?: any[]
    owner?: string
  } | null>(null)

  const [tokenBalance, setTokenBalance] = useState<bigint>(BigInt(0))
  const [tokenDecimals, setTokenDecimals] = useState<number>(18)
  const [tokenSymbol, setTokenSymbol] = useState<string>('MTK')

  const [maxTokenId] = useState(100)
  const [status, setStatus] = useState<string>('')
  const [balanceError, setBalanceError] = useState<string>('')

  // Search & Like State
  const [searchQuery, setSearchQuery] = useState('')
  const [likedTokenIds, setLikedTokenIds] = useState<Set<string>>(new Set())

  useEffect(() => setMounted(true), [])

  // Load Likes from LocalStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLikes = localStorage.getItem('likedMainTokenIds')
      if (savedLikes) {
        setLikedTokenIds(new Set(JSON.parse(savedLikes)))
      }
    }
  }, [])

  const handleToggleLike = (tokenId: bigint) => {
    const idStr = tokenId.toString()
    setLikedTokenIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(idStr)) {
        newSet.delete(idStr)
      } else {
        newSet.add(idStr)
      }
      localStorage.setItem('likedMainTokenIds', JSON.stringify(Array.from(newSet)))
      return newSet
    })
  }

  // 배치 처리
  const processBatch = async <T, R>(
    items: T[],
    batchSize: number,
    processor: (item: T) => Promise<R | null>
  ): Promise<R[]> => {
    const results: R[] = []
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(batch.map(processor))
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value !== null) {
          results.push(result.value)
        }
      })
    }
    return results
  }

  const convertIPFSUrl = (url: string): string => {
    if (url.startsWith('ipfs://')) {
      const hash = url.replace('ipfs://', '')
      return getIPFSGatewayUrl(hash)
    }
    return url
  }

  const fetchMetadata = async (tokenURI: string) => {
    try {
      let url = tokenURI
      if (tokenURI.startsWith('ipfs://')) {
        const hash = tokenURI.replace('ipfs://', '')
        url = getIPFSGatewayUrl(hash)
      }

      const response = await fetch(url)
      if (!response.ok) return null

      const metadata = await response.json()
      if (metadata.image) metadata.image = convertIPFSUrl(metadata.image)
      return metadata
    } catch {
      return null
    }
  }

  const fetchListings = async () => {
    setIsLoading(true)
    try {
      const tokenIds = Array.from({ length: maxTokenId + 1 }, (_, i) =>
        BigInt(i)
      )

      const listedTokens: Array<{
        tokenId: bigint
        listing: Awaited<ReturnType<typeof getListing>>
      }> = []

      await processBatch(tokenIds, 20, async (tokenId) => {
        try {
          const listing = await getListing(tokenId)
          if (listing.isListed) return { tokenId, listing }
        } catch {}
        return null
      }).then((results) => listedTokens.push(...results))

      if (listedTokens.length === 0) {
        setListings([])
        return
      }

      const listingPromises = listedTokens.map(
        async ({ tokenId, listing }): Promise<NFTListing> => {
          let image: string | undefined
          let name: string | undefined

          try {
            const tokenURI = await getTokenURI(tokenId)
            const metadata = await fetchMetadata(tokenURI)
            image = metadata?.image
            name = metadata?.name
          } catch {}

          return {
            tokenId,
            price: listing.price,
            seller: listing.seller,
            isListed: true,
            image,
            name,
          }
        }
      )

      setListings(await Promise.all(listingPromises))
    } catch (error) {
      console.error('목록 조회 오류:', error)
      setListings([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTokenInfo = async () => {
    if (!isConnected || !address) return
    try {
      const [decimals, symbol, balance] = await Promise.all([
        getTokenDecimals(),
        getTokenSymbol(),
        getTokenBalance(address).catch((err) => {
          setBalanceError(`잔액 조회 실패: ${err.message || '알 수 없는 오류'}`)
          return BigInt(0)
        }),
      ])

      setTokenDecimals(decimals)
      setTokenSymbol(symbol)
      setTokenBalance(balance)
      setBalanceError('')
    } catch (error: any) {
      setBalanceError(
        `토큰 정보 조회 실패: ${error.message || '알 수 없는 오류'}`
      )
    }
  }

  const fetchNFTDetails = async (listing: NFTListing) => {
    try {
      const tokenURI = await getTokenURI(listing.tokenId)
      const metadata = await fetchMetadata(tokenURI)
      const owner = await ownerOf(listing.tokenId)

      setNftDetails({
        description: metadata?.description,
        attributes: metadata?.attributes,
        owner,
      })
    } catch {
      setNftDetails(null)
    }
  }

  const handleNFTClick = async (listing: NFTListing) => {
    setSelectedNFT(listing)
    await fetchNFTDetails(listing)
  }

  useEffect(() => {
    if (mounted && isConnected) {
      fetchListings()
      fetchTokenInfo()
    }
  }, [mounted, isConnected, address])

  const handleBuy = async (tokenId: bigint, price: bigint) => {
    if (!isConnected || !address) {
      alert('지갑을 연결해주세요.')
      return
    }

    try {
      // 0) 잔액 체크
      if (tokenBalance < price) {
        throw new Error(
          `토큰 잔액이 부족합니다. 필요: ${formatTokenAmount(
            price,
            tokenDecimals
          )} ${tokenSymbol}`
        )
      }

      // 1) allowance 체크
      const allowance = await getTokenAllowance(
        address,
        marketplaceContractAddress as `0x${string}`
      )

      if (allowance < price) {
        setStatus('토큰 승인 중... (approve)')
        const receipt = await approveToken(
          marketplaceContractAddress as `0x${string}`,
          price 
        )
        setStatus(`토큰 승인 완료. 트랜잭션: ${receipt.transactionHash}`)
      }

      // 2) buy
      setStatus('NFT 구매 중...')
      const receipt2 = await buyNFT(tokenId)
      setStatus(`구매 완료! 트랜잭션: ${receipt2.transactionHash}`)

      await fetchListings()
      await fetchTokenInfo()
      setTimeout(() => setStatus(''), 5000)
    } catch (error: any) {
      console.error('구매 오류:', error)
      setStatus(`구매 실패: ${error.message || '알 수 없는 오류'}`)
      setTimeout(() => setStatus(''), 6000)
    }
  }

  const handleCancel = async (tokenId: bigint) => {
    if (!isConnected || !address) {
      alert('지갑을 연결해주세요.')
      return
    }

    try {
      setStatus('판매 취소 중...')
      const receipt = await cancelListing(tokenId)
      setStatus(`판매 취소 완료! 트랜잭션: ${receipt.transactionHash}`)
      await fetchListings()
      setTimeout(() => setStatus(''), 5000)
    } catch (error: any) {
      console.error('판매 취소 오류:', error)
      setStatus(`판매 취소 실패: ${error.message || '알 수 없는 오류'}`)
      setTimeout(() => setStatus(''), 6000)
    }
  }

  // 검색 필터링
  const filteredListings = listings.filter((item) => {
    const query = searchQuery.toLowerCase()
    const nameMatch = item.name?.toLowerCase().includes(query)
    const idMatch = item.tokenId.toString().includes(query)
    return nameMatch || idMatch
  })

  // 좋아요 우선 정렬 (선택사항) 또는 필터링? 현재는 그대로 표시
  // const sortedListings = [...filteredListings].sort(...) 

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
        <p className='text-emerald-800 font-medium'>
          마켓플레이스를 사용하려면 먼저 지갑을 연결해주세요.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-8'>
      {/* 상태 바 (잔액 & 검색) */}
      <div className='flex flex-col gap-6 md:flex-row'>
        {/* 잔액 카드 */}
        <div className='flex-1 p-6 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-emerald-100/50 flex items-center justify-between group hover:shadow-md transition-all'>
          <div>
            <p className='text-sm text-slate-500 mb-1 font-medium'>내 토큰 잔액</p>
            <p className='text-3xl font-black text-emerald-600 tracking-tight'>
              {formatTokenAmount(tokenBalance, tokenDecimals)} <span className="text-xl font-bold text-emerald-400">{tokenSymbol}</span>
            </p>
          </div>
          <button
            onClick={fetchTokenInfo}
            className='px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold transition-colors'
          >
            갱신
          </button>
        </div>
      </div>

      {status && (
          <div
            className={`p-4 rounded-xl border shadow-sm text-sm font-semibold animate-fadeIn ${
              status.includes('완료')
                ? 'bg-green-50 border-green-100 text-green-700'
                : status.includes('실패')
                ? 'bg-red-50 border-red-100 text-red-700'
                : 'bg-emerald-50 border-emerald-100 text-emerald-700'
            }`}
          >
            {status}
          </div>
        )}

      {/* 헤더 & 검색바 */}
      <div className='flex flex-col md:flex-row justify-between items-end border-b border-emerald-100 pb-4 gap-4'>
        <div>
          <h2 className='text-3xl font-bold text-slate-800 tracking-tight'>마켓플레이스</h2>
          <p className='text-slate-500 mt-2 font-medium'>
            유니크한 NFT를 탐색하고 수집해보세요.
          </p>
        </div>

        <div className="flex gap-3 w-full md:w-auto items-center">
          {/* 검색바 */}
          <div className='relative w-full md:w-64'>
             <input 
               type="text" 
               placeholder="이름 또는 ID 검색..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full pl-10 pr-4 py-2.5 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm font-medium"
             />
             <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>

          <button
            onClick={() => {
              fetchListings()
              fetchTokenInfo()
            }}
            disabled={isLoading}
            className='px-5 py-2.5 bg-white border border-emerald-100 text-slate-600 font-semibold rounded-xl hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-sm transition-all disabled:opacity-50 whitespace-nowrap'
          >
            {isLoading ? '로딩 중...' : '새로고침'}
          </button>
        </div>
      </div>

      {/* NFT 그리드 */}
      {listings.length === 0 ? (
         <div className="py-20 text-center text-emerald-500 font-bold">
            {isLoading ? "로딩 중..." : "판매 중인 NFT가 없습니다."}
         </div>
      ) : filteredListings.length === 0 ? (
        <div className='min-h-[300px] flex flex-col items-center justify-center bg-white/40 rounded-3xl border border-dashed border-emerald-200/50'>
          <p className='text-xl text-emerald-400 font-bold'>
            검색 결과가 없습니다 😢
          </p>
          <button onClick={() => setSearchQuery('')} className="mt-2 text-emerald-600 font-bold hover:underline">
             검색 초기화
          </button>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
          {filteredListings.map((listing) => (
            <NFTCard
              key={listing.tokenId.toString()}
              listing={listing}
              tokenDecimals={tokenDecimals}
              tokenSymbol={tokenSymbol}
              isOwner={listing.seller.toLowerCase() === address?.toLowerCase()}
              isLiked={likedTokenIds.has(listing.tokenId.toString())}
              onToggleLike={() => handleToggleLike(listing.tokenId)}
              onBuy={handleBuy}
              onCancel={handleCancel}
              onClick={() => handleNFTClick(listing)}
            />
          ))}
        </div>
      )}

      {/* 상세 모달 */}
      {selectedNFT && (
        <NFTDetailModal
          listing={selectedNFT}
          tokenDecimals={tokenDecimals}
          tokenSymbol={tokenSymbol}
          details={nftDetails}
          onClose={() => {
            setSelectedNFT(null)
            setNftDetails(null)
          }}
          onBuy={handleBuy}
          onCancel={handleCancel}
          isOwner={selectedNFT.seller.toLowerCase() === address?.toLowerCase()}
          isLiked={likedTokenIds.has(selectedNFT.tokenId.toString())}
          onToggleLike={() => handleToggleLike(selectedNFT.tokenId)}
        />
      )}
    </div>
  )
}

function NFTCard({
  listing,
  tokenDecimals,
  tokenSymbol,
  isOwner,
  isLiked,
  onToggleLike,
  onBuy,
  onCancel,
  onClick,
}: {
  listing: NFTListing
  tokenDecimals: number
  tokenSymbol: string
  isOwner: boolean
  isLiked: boolean
  onToggleLike: () => void
  onBuy: (tokenId: bigint, price: bigint) => void
  onCancel: (tokenId: bigint) => void
  onClick: () => void
}) {
  return (
    <div
      className='group relative bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-emerald-50 overflow-hidden cursor-pointer flex flex-col'
      onClick={onClick}
    >
      <div className='relative w-full aspect-square overflow-hidden bg-emerald-50/30'>
        {listing.image ? (
          <img
            src={listing.image}
            alt={listing.name || `NFT #${listing.tokenId.toString()}`}
            className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className='w-full h-full flex items-center justify-center text-emerald-200'>
            <svg
              className='w-12 h-12'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
              />
            </svg>
          </div>
        )}
        
        {/* Like Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleLike()
          }}
          className='absolute top-3 right-3 p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-md hover:bg-white transition-all transform hover:scale-110 z-10'
          title={isLiked ? "취소" : "좋아요"}
        >
          <svg 
            className={`w-5 h-5 transition-colors ${isLiked ? 'text-red-500 fill-current' : 'text-slate-400'}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      <div className='p-5 flex flex-col flex-1'>
        <div className='flex justify-between items-start mb-2'>
          <h4 className='font-bold text-slate-800 line-clamp-1 group-hover:text-emerald-600 transition-colors'>
            {listing.name || `NFT #${listing.tokenId.toString()}`}
          </h4>
          <span className='px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-xs font-mono font-bold'>
            #{listing.tokenId.toString()}
          </span>
        </div>

        <div className='mt-auto pt-4'>
          <p className='text-xs text-slate-400 font-bold uppercase mb-1'>Price</p>
          <p className='text-lg font-black text-emerald-600'>
            {formatTokenAmount(listing.price, tokenDecimals)} <span className='text-sm font-bold text-emerald-400'>{tokenSymbol}</span>
          </p>
        </div>

        <div className='mt-4 flex gap-2 pt-4 border-t border-emerald-50'>
          {isOwner ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCancel(listing.tokenId)
              }}
              className='flex-1 py-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 hover:text-red-600 transition-colors font-bold text-sm'
            >
              판매 취소
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onBuy(listing.tokenId, listing.price)
              }}
              className='flex-1 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-md hover:shadow-lg font-bold text-sm'
            >
              구매하기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function NFTDetailModal({
  listing,
  tokenDecimals,
  tokenSymbol,
  details,
  onClose,
  onBuy,
  onCancel,
  isOwner,
  isLiked,
  onToggleLike
}: {
  listing: NFTListing
  tokenDecimals: number
  tokenSymbol: string
  details: {
    description?: string
    attributes?: any[]
    owner?: string
  } | null
  onClose: () => void
  onBuy: (tokenId: bigint, price: bigint) => void
  onCancel: (tokenId: bigint) => void
  isOwner: boolean
  isLiked: boolean
  onToggleLike: () => void
}) {
  const getTokenEtherscanUrl = (tokenId: bigint) =>
    `https://sepolia.etherscan.io/token/${nftContractAddress}?a=${tokenId.toString()}`

  return (
    <div 
      className='fixed inset-0 bg-emerald-950/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn'
      onClick={onClose}
    >
      <div 
        className='bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row'
        onClick={e => e.stopPropagation()}
      >
        {/* Left: Image */}
        <div className='w-full md:w-1/2 bg-emerald-50/50 flex items-center justify-center p-8 border-b md:border-b-0 md:border-r border-emerald-100 relative'>
           {listing.image ? (
            <img
              src={listing.image}
              alt={listing.name}
              className='max-w-full max-h-[50vh] object-contain rounded-xl shadow-lg'
            />
          ) : (
            <div className='text-emerald-300 font-medium'>이미지가 없습니다</div>
          )}
           
           <button
            onClick={onToggleLike}
            className='absolute top-4 left-4 p-3 rounded-full bg-white/80 backdrop-blur-md shadow-lg hover:scale-110 transition-transform'
           >
              <svg 
                className={`w-6 h-6 ${isLiked ? 'text-red-500 fill-current' : 'text-slate-400'}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
           </button>
        </div>

        {/* Right: Details */}
        <div className='w-full md:w-1/2 p-8 overflow-y-auto'>
           <div className='flex justify-between items-start mb-6'>
             <div>
               <h2 className='text-3xl font-black text-slate-800 mb-2 tracking-tight'>
                 {listing.name || `NFT #${listing.tokenId.toString()}`}
               </h2>
               <div className='flex gap-2'>
                 <span className='px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold'>
                   ID: {listing.tokenId.toString()}
                 </span>
                 {isLiked && <span className='px-3 py-1 rounded-full bg-red-100 text-red-600 text-xs font-bold'>❤️ Liked</span>}
               </div>
             </div>
             <button
               onClick={onClose}
               className='p-2 rounded-full hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors'
             >
               <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12'/></svg>
             </button>
           </div>

           <div className='space-y-6'>
             {/* Price */}
             <div className='p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100'>
               <p className='text-sm font-bold text-emerald-600 mb-1 uppercase'>Price</p>
               <p className='text-3xl font-black text-slate-900'>
                 {formatTokenAmount(listing.price, tokenDecimals)} <span className="text-xl text-emerald-500">{tokenSymbol}</span>
               </p>
             </div>

             {/* Description */}
             {details?.description && (
               <div>
                 <h3 className='font-bold text-slate-400 text-xs uppercase mb-2'>Description</h3>
                 <p className='text-slate-600 leading-relaxed text-sm font-medium'>
                   {details.description}
                 </p>
               </div>
             )}

             {/* Attributes */}
             {details?.attributes && details.attributes.length > 0 && (
               <div>
                 <h3 className='font-bold text-slate-400 text-xs uppercase mb-3'>Attributes</h3>
                 <div className='grid grid-cols-2 gap-3'>
                   {details.attributes.map((attr: any, index: number) => (
                     <div key={index} className='p-3 bg-white rounded-xl border border-emerald-100 shadow-sm text-center'>
                       <p className='text-[10px] text-emerald-500 font-bold uppercase mb-1'>{attr.trait_type || 'Attribute'}</p>
                       <p className='font-bold text-slate-800 text-sm'>{attr.value}</p>
                     </div>
                   ))}
                 </div>
               </div>
             )}

             {/* Actions */}
             <div className='flex gap-3 pt-6 border-t border-emerald-100'>
               {isOwner ? (
                 <button
                   onClick={() => {
                     onCancel(listing.tokenId)
                     onClose()
                   }}
                   className='flex-1 py-3.5 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors'
                 >
                   판매 취소
                 </button>
               ) : (
                 <button
                   onClick={() => {
                     onBuy(listing.tokenId, listing.price)
                     onClose()
                   }}
                   className='flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all'
                 >
                   구매하기
                 </button>
               )}
                <a
                 href={getTokenEtherscanUrl(listing.tokenId)}
                 target='_blank'
                 rel='noopener noreferrer'
                 className='px-4 py-3 bg-slate-100 text-slate-500 font-semibold rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-colors flex items-center justify-center'
               >
                 Scan ↗
               </a>
             </div>
           </div>
        </div>
      </div>
    </div>
  )
}
