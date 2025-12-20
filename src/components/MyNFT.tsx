'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import {
  getTokenURI,
  getListing,
  listNFT,
  cancelListing,
  balanceOf,
  ownerOf,
  isApprovedForAll,
  setApprovalForAllNFT,
} from '@/lib/contracts'
import { marketplaceContractAddress } from '@/lib/constants'
import { MintNFTModal } from './MintNFTModal'
import { getIPFSGatewayUrl } from '@/lib/ipfs'

interface NFTItem {
  tokenId: bigint
  tokenURI: string
  image?: string
  name?: string
  description?: string
  attributes?: any[]
  isListed?: boolean
  price?: bigint
}

export function MyNFT() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()

  const [nfts, setNfts] = useState<NFTItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showMintModal, setShowMintModal] = useState(false)
  const [selectedNFT, setSelectedNFT] = useState<NFTItem | null>(null)
  
  // Listing Modal State
  const [showListModal, setShowListModal] = useState(false)
  const [listingPrice, setListingPrice] = useState('')
  const [isListing, setIsListing] = useState(false)
  const [listingStatus, setListingStatus] = useState('')
  const [listingTokenId, setListingTokenId] = useState<bigint | null>(null)

  // Common State
  const [tokenDecimals] = useState<number>(18)
  const [tokenSymbol] = useState<string>('MTK')

  // Scan limits
  const [maxTokenId] = useState(100)

  useEffect(() => {
    setMounted(true)
  }, [])

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
      
      // 이미지 URL 변환
      if (metadata.image && metadata.image.startsWith('ipfs://')) {
        metadata.image = getIPFSGatewayUrl(metadata.image.replace('ipfs://', ''))
      }
      
      return metadata
    } catch {
      return null
    }
  }

  // 배치 처리 헬퍼
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

  const fetchMyNFTs = async () => {
    if (!isConnected || !address) return

    setIsLoading(true)
    try {
      // 1. 전체 토큰 ID 스캔 (0 ~ maxTokenId)
      // Enumerable 확장이 없으므로 직접 스캔해야 함
      const tokenIds = Array.from({ length: maxTokenId + 1 }, (_, i) => BigInt(i))

      const myTokens = await processBatch(tokenIds, 20, async (tokenId) => {
        try {
          // 소유자 확인
          const owner = await ownerOf(tokenId)
          if (owner.toLowerCase() === address.toLowerCase()) {
             return tokenId
          }
        } catch {}
        return null
      })

      if (myTokens.length === 0) {
        setNfts([])
        return
      }

      // 2. 발견된 토큰의 메타데이터 및 리스팅 정보 조회
      const nftItems = await processBatch(myTokens, 10, async (tokenId) => {
        try {
          const tokenURI = await getTokenURI(tokenId)
          const metadata = await fetchMetadata(tokenURI)

          let isListed = false
          let price = BigInt(0)

          try {
             const listing = await getListing(tokenId)
             if (listing.isListed) {
                isListed = true
                price = listing.price
             }
          } catch {}

          return {
            tokenId,
            tokenURI,
            image: metadata?.image,
            name: metadata?.name,
            description: metadata?.description,
            attributes: metadata?.attributes,
            isListed,
            price,
          } as NFTItem
        } catch (e) {
          console.error(`Token ${tokenId} metadata load failed`, e)
          return null
        }
      })

      setNfts(nftItems)
    } catch (error) {
      console.error('NFT 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (mounted && isConnected) {
      fetchMyNFTs()
    }
  }, [mounted, isConnected, address])

  const handleListingClick = (tokenId: bigint) => {
    setListingTokenId(tokenId)
    setShowListModal(true)
    setListingPrice('')
    setListingStatus('')
  }

  const handleListConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!listingTokenId || !listingPrice || !address) return

    setIsListing(true)
    setListingStatus('')

    try {
      const priceInWei = BigInt(Math.floor(parseFloat(listingPrice) * 10 ** 18))
      
      // 1. Check Approval
      setListingStatus('마켓플레이스 승인 확인 중...')
      const isApproved = await isApprovedForAll(address, marketplaceContractAddress as `0x${string}`)
      
      if (!isApproved) {
        setListingStatus('마켓플레이스 승인 요청 중...')
        const approveReceipt = await setApprovalForAllNFT(marketplaceContractAddress as `0x${string}`, true)
        setListingStatus(`승인 완료! 트랜잭션: ${approveReceipt.transactionHash}`)
      }

      // 2. List NFT
      setListingStatus('판매 등록 중...')
      const receipt = await listNFT(listingTokenId, priceInWei)
      setListingStatus(`등록 성공! 트랜잭션: ${receipt.transactionHash}`)
      
      await fetchMyNFTs()
      setTimeout(() => {
        setShowListModal(false)
        setListingStatus('')
        setListingTokenId(null)
      }, 2000)
    } catch (error: any) {
      console.error('판매 등록 오류:', error)
      setListingStatus(`오류: ${error.message || '알 수 없는 오류'}`)
    } finally {
      setIsListing(false)
    }
  }

  const handleCancelListing = async (tokenId: bigint) => {
    if (!confirm('정말 판매를 취소하시겠습니까?')) return

    try {
      await cancelListing(tokenId)
      alert('판매가 취소되었습니다.')
      fetchMyNFTs()
    } catch (error: any) {
      alert(`취소 실패: ${error.message}`)
    }
  }

  if (!mounted) return null

  if (!isConnected) {
    return (
      <div className='p-12 text-center bg-white/50 backdrop-blur-md rounded-3xl border border-emerald-50'>
        <p className='text-emerald-800 font-bold mb-4'>지갑 연결이 필요합니다</p>
        <p className='text-emerald-600/70 text-sm'>
          우측 상단 버튼을 통해 지갑을 연결해주세요.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-8 animate-fadeIn'>
      {/* Header */}
      <div className='flex flex-col md:flex-row justify-between items-center bg-gradient-to-r from-emerald-900 to-teal-900 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden'>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 text-center md:text-left mb-6 md:mb-0">
          <h2 className='text-3xl font-black tracking-tight mb-2'>내 컬렉션</h2>
          <p className='text-emerald-200 font-medium'>
            총 NFT <span className="text-white font-bold text-lg mx-1">{nfts.length}</span>개 보유 중
          </p>
        </div>
        
        <div className='relative z-10 flex gap-3'>
          <button
             onClick={() => setShowMintModal(true)}
             className='px-6 py-3 bg-white text-emerald-900 font-bold rounded-xl hover:bg-emerald-50 transition-colors shadow-lg'
          >
            + 새 NFT 만들기
          </button>
          <button 
             onClick={fetchMyNFTs} 
             disabled={isLoading}
             className='px-6 py-3 bg-emerald-800/50 border border-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition-colors backdrop-blur-sm'
          >
            {isLoading ? '로딩 중...' : '새로고침'}
          </button>
        </div>
      </div>

      {/* NFT Grid */}
      {isLoading ? (
        <div className="py-20 text-center">
           <div className="inline-block w-10 h-10 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin"></div>
        </div>
      ) : nfts.length === 0 ? (
        <div className='bg-white/60 border-2 border-dashed border-emerald-100 rounded-3xl p-16 text-center'>
          <p className='text-2xl font-bold text-slate-400 mb-4'>보유한 NFT가 없습니다 😢</p>
          <p className='text-slate-500 mb-8'>첫 번째 NFT를 민팅하고 컬렉션을 시작해보세요!</p>
          <button 
            onClick={() => setShowMintModal(true)}
            className='px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all'
          >
            지금 민팅하기
          </button>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6'>
          {nfts.map((nft) => (
            <div
              key={nft.tokenId.toString()}
              className='group bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-emerald-50 overflow-hidden cursor-pointer flex flex-col'
              onClick={() => setSelectedNFT(nft)}
            >
               <div className='relative aspect-square bg-emerald-50/30 overflow-hidden'>
                 {nft.image ? (
                   <img 
                      src={nft.image} 
                      alt={nft.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                   />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-emerald-200">
                      <span className="text-4xl">🖼️</span>
                   </div>
                 )}
                 {nft.isListed && (
                   <div className="absolute top-3 right-3 px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full shadow-md z-10">
                     판매 중
                   </div>
                 )}
               </div>

               <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                     <h4 className="font-bold text-slate-800 line-clamp-1">{nft.name || `NFT #${nft.tokenId}`}</h4>
                     <span className="text-emerald-500 font-mono text-xs font-bold bg-emerald-50 px-2 py-1 rounded">#{nft.tokenId.toString()}</span>
                  </div>
                  
                  <div className="mt-auto pt-4 space-y-2">
                    {nft.isListed ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCancelListing(nft.tokenId)
                        }}
                        className="w-full py-2.5 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 font-bold rounded-xl text-sm transition-colors"
                      >
                        판매 취소
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleListingClick(nft.tokenId)
                        }}
                        className="w-full py-2.5 bg-slate-900 text-white hover:bg-emerald-600 font-bold rounded-xl text-sm transition-colors shadow-md"
                      >
                        판매 등록
                      </button>
                    )}
                  </div>
               </div>
            </div>
          ))}
        </div>
      )}

      {/* Mint Modal */}
      {showMintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/20 backdrop-blur-sm animate-fadeIn">
           <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
              <button 
                onClick={() => setShowMintModal(false)}
                className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors z-10"
              >
                ✕
              </button>
              <MintNFTModal 
                onClose={() => setShowMintModal(false)} 
                onSuccess={() => {
                  fetchMyNFTs()
                  setShowMintModal(false)
                }} 
              />
           </div>
        </div>
      )}

      {/* NFT Detail Modal */}
      {selectedNFT && (
         <div 
           className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/20 backdrop-blur-sm animate-fadeIn"
           onClick={() => setSelectedNFT(null)}
         >
            <div 
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
               <div className="aspect-square rounded-2xl bg-emerald-50 overflow-hidden mb-6 shadow-inner">
                  {selectedNFT.image && (
                    <img src={selectedNFT.image} alt={selectedNFT.name} className="w-full h-full object-cover" />
                  )}
               </div>
               
               <h3 className="text-2xl font-black text-slate-800 mb-2">{selectedNFT.name || `NFT #${selectedNFT.tokenId}`}</h3>
               <p className="text-slate-500 mb-6 text-sm leading-relaxed">{selectedNFT.description || '설명이 없습니다.'}</p>

               <div className="grid grid-cols-2 gap-3 mb-6">
                 {selectedNFT.attributes?.map((attr: any, i: number) => (
                    <div key={i} className="bg-emerald-50 rounded-xl p-3 text-center">
                       <p className="text-[10px] uppercase font-bold text-emerald-500 mb-1">{attr.trait_type}</p>
                       <p className="font-bold text-slate-700 text-sm">{attr.value}</p>
                    </div>
                 ))}
               </div>

               <button 
                 onClick={() => setSelectedNFT(null)}
                 className="w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
               >
                 닫기
               </button>
            </div>
         </div>
      )}

      {/* Sell Listing Modal */}
      {showListModal && (
        <div className='fixed inset-0  bg-emerald-950/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn'>
          <div className='bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full'>
            <div className='flex justify-between items-center mb-6'>
              <h3 className='text-2xl font-bold text-slate-800'>판매 등록</h3>
              <button 
                 onClick={() => setShowListModal(false)}
                 className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                 ✕
              </button>
            </div>

            <form onSubmit={handleListConfirm} className='space-y-6'>
              <div className="group">
                <label className='block text-sm font-bold text-slate-600 mb-2'>
                  판매 가격 ({tokenSymbol})
                </label>
                <input
                  type='number'
                  value={listingPrice}
                  onChange={(e) => setListingPrice(e.target.value)}
                  placeholder='0.0'
                  step='0.000000000000000001'
                  min='0'
                  className='w-full px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono font-bold text-lg'
                  required
                  disabled={isListing}
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-500 leading-relaxed">
                 ℹ️ 판매 등록 시 마켓플레이스 승인(Approve) 트랜잭션이 추가로 발생할 수 있습니다.
              </div>

              <button
                type='submit'
                disabled={isListing || !listingPrice}
                className='w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:transform-none'
              >
                {isListing ? '처리 중...' : '판매 등록하기'}
              </button>

              {listingStatus && (
                <div className={`p-3 rounded-xl text-center text-sm font-bold ${
                   listingStatus.includes('성공') ? 'bg-green-50 text-green-700' : 
                   listingStatus.includes('오류') ? 'bg-red-50 text-red-700' : 
                   'bg-blue-50 text-blue-700'
                }`}>
                  {listingStatus}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
