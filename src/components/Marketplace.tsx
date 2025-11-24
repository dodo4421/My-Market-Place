'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import {
  getListing,
  buyNFT,
  listNFT,
  cancelListing,
  approveNFT,
  approveToken,
  getTokenBalance,
  getTokenAllowance,
  getTokenDecimals,
  getTokenSymbol,
  formatTokenAmount,
  parseTokenAmount,
  ownerOf,
  getTokenURI,
} from '@/lib/contracts'
import {
  marketplaceContractAddress,
  tokenContractAddress,
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
  const [maxTokenId, setMaxTokenId] = useState(100) // 최대 조회할 토큰 ID 범위
  const [status, setStatus] = useState<string>('')
  const [balanceError, setBalanceError] = useState<string>('')

  // 클라이언트에서만 마운트되도록 처리
  useEffect(() => {
    setMounted(true)
  }, [])

  // 배치 처리 헬퍼 함수
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

  // NFT 목록 조회 (최적화: 병렬 처리)
  const fetchListings = async () => {
    setIsLoading(true)
    const allListings: NFTListing[] = []

    try {
      // 모든 토큰 ID의 리스팅 정보를 병렬로 확인 (배치 처리)
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
          if (listing.isListed) {
            return { tokenId, listing }
          }
        } catch {
          // 토큰이 존재하지 않거나 리스팅되지 않음
        }
        return null
      }).then((results) => {
        listedTokens.push(...results)
      })

      if (listedTokens.length === 0) {
        setListings([])
        setIsLoading(false)
        return
      }

      // 리스팅된 NFT의 메타데이터를 병렬로 조회
      const listingPromises = listedTokens.map(
        async ({ tokenId, listing }): Promise<NFTListing> => {
          let image: string | undefined
          let name: string | undefined

          try {
            const tokenURI = await getTokenURI(tokenId)
            const metadata = await fetchMetadata(tokenURI)
            image = metadata?.image
            name = metadata?.name
          } catch (error) {
            console.warn(`Token ${tokenId} metadata fetch failed:`, error)
          }

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

      const listings = await Promise.all(listingPromises)
      setListings(listings)
    } catch (error) {
      console.error('목록 조회 오류:', error)
      setListings([])
    }

    setIsLoading(false)
  }

  // NFT 상세 정보 가져오기
  const fetchNFTDetails = async (listing: NFTListing) => {
    try {
      const tokenURI = await getTokenURI(listing.tokenId)
      const metadata = await fetchMetadata(tokenURI)
      const owner = await ownerOf(listing.tokenId)

      setNftDetails({
        description: metadata?.description,
        attributes: metadata?.attributes,
        owner: owner,
      })
    } catch (error) {
      console.error('NFT 상세 정보 가져오기 오류:', error)
      setNftDetails(null)
    }
  }

  // NFT 카드 클릭 핸들러
  const handleNFTClick = async (listing: NFTListing) => {
    setSelectedNFT(listing)
    await fetchNFTDetails(listing)
  }

  // 토큰 정보 및 잔액 조회
  const fetchTokenInfo = async () => {
    if (!isConnected || !address) return

    try {
      // 토큰 정보 조회 (decimals, symbol)
      const [decimals, symbol, balance] = await Promise.all([
        getTokenDecimals(),
        getTokenSymbol(),
        getTokenBalance(address).catch((err) => {
          console.error('토큰 잔액 조회 오류:', err)
          setBalanceError(`잔액 조회 실패: ${err.message || '알 수 없는 오류'}`)
          return BigInt(0)
        }),
      ])

      setTokenDecimals(decimals)
      setTokenSymbol(symbol)
      setTokenBalance(balance)
      setBalanceError('')

      console.log('토큰 정보:', {
        decimals,
        symbol,
        balance: balance.toString(),
      })
    } catch (error: any) {
      console.error('토큰 정보 조회 오류:', error)
      setBalanceError(
        `토큰 정보 조회 실패: ${error.message || '알 수 없는 오류'}`
      )
    }
  }

  // IPFS URL을 게이트웨이 URL로 변환
  const convertIPFSUrl = (url: string): string => {
    if (url.startsWith('ipfs://')) {
      const hash = url.replace('ipfs://', '')
      return getIPFSGatewayUrl(hash)
    }
    return url
  }

  // 메타데이터 가져오기
  const fetchMetadata = async (tokenURI: string) => {
    try {
      let url = tokenURI
      if (tokenURI.startsWith('ipfs://')) {
        const hash = tokenURI.replace('ipfs://', '')
        url = getIPFSGatewayUrl(hash)
      }

      const response = await fetch(url)
      if (!response.ok) {
        console.warn('메타데이터 조회 실패:', url, response.status)
        return null
      }

      const metadata = await response.json()

      // 이미지 URL도 IPFS 형식이면 변환
      if (metadata.image) {
        metadata.image = convertIPFSUrl(metadata.image)
      }

      return metadata
    } catch (error) {
      console.error('메타데이터 가져오기 오류:', error)
      return null
    }
  }

  useEffect(() => {
    if (isConnected) {
      fetchListings()
      fetchTokenInfo()
    }
  }, [isConnected, address])

  const handleBuy = async (tokenId: bigint, price: bigint) => {
    if (!isConnected || !address) {
      alert('지갑을 연결해주세요.')
      return
    }

    try {
      // 1. 토큰 승인 확인 및 처리
      const allowance = await getTokenAllowance(
        address,
        marketplaceContractAddress as `0x${string}`
      )
      if (allowance < price) {
        setStatus('토큰 승인 중...')
        const approveHash = await approveToken(
          marketplaceContractAddress as `0x${string}`,
          price * BigInt(2) // 여유있게 승인
        )
        setStatus(`토큰 승인 완료. 트랜잭션: ${approveHash.transactionHash}`)
      }

      // 2. NFT 구매
      setStatus('NFT 구매 중...')
      const receipt = await buyNFT(tokenId)
      setStatus(`구매 완료! 트랜잭션: ${receipt.transactionHash}`)

      // 목록 새로고침
      await fetchListings()
      await fetchTokenInfo()

      setTimeout(() => setStatus(''), 5000)
    } catch (error: any) {
      console.error('구매 오류:', error)
      setStatus(`구매 실패: ${error.message || '알 수 없는 오류'}`)
      setTimeout(() => setStatus(''), 5000)
    }
  }

  const handleList = async (tokenId: bigint, price: string) => {
    if (!isConnected || !address) {
      alert('지갑을 연결해주세요.')
      return
    }

    try {
      const priceInWei = parseTokenAmount(price, tokenDecimals)

      // 1. NFT 승인 확인 및 처리
      setStatus('NFT 승인 중...')
      const approved = await approveNFT(
        marketplaceContractAddress as `0x${string}`,
        tokenId
      )
      setStatus(`NFT 승인 완료. 트랜잭션: ${approved.transactionHash}`)

      // 2. 리스팅
      setStatus('판매 등록 중...')
      const receipt = await listNFT(tokenId, priceInWei)
      setStatus(`판매 등록 완료! 트랜잭션: ${receipt.transactionHash}`)

      // 목록 새로고침
      await fetchListings()

      setTimeout(() => setStatus(''), 5000)
    } catch (error: any) {
      console.error('판매 등록 오류:', error)
      setStatus(`판매 등록 실패: ${error.message || '알 수 없는 오류'}`)
      setTimeout(() => setStatus(''), 5000)
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

      // 목록 새로고침
      await fetchListings()

      setTimeout(() => setStatus(''), 5000)
    } catch (error: any) {
      console.error('판매 취소 오류:', error)
      setStatus(`판매 취소 실패: ${error.message || '알 수 없는 오류'}`)
      setTimeout(() => setStatus(''), 5000)
    }
  }

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
          마켓플레이스를 사용하려면 먼저 지갑을 연결해주세요.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {/* 토큰 잔액 및 상태 */}
      <div className='space-y-2'>
        <div className='p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-blue-800 dark:text-blue-200 font-semibold'>
                내 토큰 잔액: {formatTokenAmount(tokenBalance, tokenDecimals)}{' '}
                {tokenSymbol}
              </p>
              {tokenBalance === BigInt(0) && (
                <p className='text-xs text-blue-600 dark:text-blue-300 mt-1'>
                  토큰이 없습니다. MetaMask에서 토큰을 추가했는지 확인하세요.
                </p>
              )}
            </div>
            <button
              onClick={fetchTokenInfo}
              className='text-xs px-3 py-1 bg-blue-200 dark:bg-blue-800 rounded hover:bg-blue-300 dark:hover:bg-blue-700'
            >
              새로고침
            </button>
          </div>
          {balanceError && (
            <p className='text-xs text-red-600 dark:text-red-400 mt-2'>
              ⚠️ {balanceError}
            </p>
          )}
        </div>
        {status && (
          <div
            className={`p-3 rounded-lg ${
              status.includes('완료')
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                : status.includes('실패')
                ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200'
            }`}
          >
            <p className='text-sm'>{status}</p>
          </div>
        )}
      </div>

      {/* 새로고침 버튼 */}
      <div className='flex justify-between items-center'>
        <h2 className='text-2xl font-bold'>마켓플레이스</h2>
        <button
          onClick={() => {
            fetchListings()
            fetchTokenInfo()
          }}
          disabled={isLoading}
          className='px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50'
        >
          {isLoading ? '로딩 중...' : '새로고침'}
        </button>
      </div>

      {/* 판매 중인 NFT 목록 */}
      <div>
        <h3 className='text-xl font-semibold mb-4'>판매 중인 NFT</h3>
        {listings.length === 0 ? (
          <p className='text-gray-500'>판매 중인 NFT가 없습니다.</p>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {listings.map((listing) => (
              <NFTCard
                key={listing.tokenId.toString()}
                listing={listing}
                onBuy={handleBuy}
                isOwner={
                  listing.seller.toLowerCase() === address?.toLowerCase()
                }
                onCancel={handleCancel}
                onClick={() => handleNFTClick(listing)}
              />
            ))}
          </div>
        )}
      </div>

      {/* NFT 상세 정보 모달 */}
      {selectedNFT && (
        <NFTDetailModal
          listing={selectedNFT}
          details={nftDetails}
          onClose={() => {
            setSelectedNFT(null)
            setNftDetails(null)
          }}
          onBuy={handleBuy}
          isOwner={selectedNFT.seller.toLowerCase() === address?.toLowerCase()}
          onCancel={handleCancel}
          address={address}
        />
      )}
    </div>
  )
}

// NFT 카드 컴포넌트
function NFTCard({
  listing,
  onBuy,
  isOwner,
  onCancel,
  onClick,
}: {
  listing: NFTListing
  onBuy: (tokenId: bigint, price: bigint) => void
  isOwner: boolean
  onCancel: (tokenId: bigint) => void
  onClick: () => void
}) {
  const [image, setImage] = useState<string | null>(null)
  const [name, setName] = useState<string>(`NFT #${listing.tokenId.toString()}`)

  // IPFS URL을 게이트웨이 URL로 변환
  const convertIPFSUrl = (url: string): string => {
    if (url.startsWith('ipfs://')) {
      const hash = url.replace('ipfs://', '')
      return getIPFSGatewayUrl(hash)
    }
    return url
  }

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const { getTokenURI } = await import('@/lib/contracts')
        const { getIPFSGatewayUrl } = await import('@/lib/ipfs')

        const tokenURI = await getTokenURI(listing.tokenId)
        let url = tokenURI
        if (tokenURI.startsWith('ipfs://')) {
          const hash = tokenURI.replace('ipfs://', '')
          url = getIPFSGatewayUrl(hash)
        }

        const response = await fetch(url)
        if (response.ok) {
          const metadata = await response.json()

          // 이미지 URL도 IPFS 형식이면 변환
          let imageUrl = metadata.image
          if (imageUrl) {
            imageUrl = convertIPFSUrl(imageUrl)
          }

          setImage(imageUrl)
          setName(metadata.name || `NFT #${listing.tokenId.toString()}`)
        } else {
          console.warn('메타데이터 조회 실패:', url, response.status)
        }
      } catch (error) {
        console.error('메타데이터 로드 오류:', error)
      }
    }

    loadMetadata()
  }, [listing.tokenId])

  return (
    <div
      className='p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-shadow'
      onClick={onClick}
    >
      {image && (
        <img
          src={image}
          alt={name}
          className='w-full h-48 object-cover rounded-lg mb-4'
        />
      )}
      <h4 className='font-semibold mb-2'>{name}</h4>
      <p className='text-sm text-gray-500 mb-2'>
        Token ID: {listing.tokenId.toString()}
      </p>
      <p className='text-lg font-bold mb-4'>
        가격: {formatTokenAmount(listing.price)} MTK
      </p>
      <div className='flex gap-2'>
        {isOwner ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCancel(listing.tokenId)
            }}
            className='flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600'
          >
            판매 취소
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onBuy(listing.tokenId, listing.price)
            }}
            className='flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600'
          >
            구매하기
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
          className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600'
        >
          상세보기
        </button>
      </div>
    </div>
  )
}

// NFT 상세 정보 모달 컴포넌트
function NFTDetailModal({
  listing,
  details,
  onClose,
  onBuy,
  isOwner,
  onCancel,
  address,
}: {
  listing: NFTListing
  details: {
    description?: string
    attributes?: any[]
    owner?: string
  } | null
  onClose: () => void
  onBuy: (tokenId: bigint, price: bigint) => void
  isOwner: boolean
  onCancel: (tokenId: bigint) => void
  address?: string
}) {
  const getEtherscanUrl = (tokenId: bigint) => {
    return `https://sepolia.etherscan.io/token/0xDa3f9D3950e8e274a9e61c5FC55a632D64f2Ec69?a=${tokenId.toString()}`
  }

  const getAddressUrl = (addr: string) => {
    return `https://sepolia.etherscan.io/address/${addr}`
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto'>
        <div className='p-6'>
          <div className='flex justify-between items-start mb-4'>
            <h2 className='text-2xl font-bold'>
              {listing.name || `NFT #${listing.tokenId.toString()}`}
            </h2>
            <button
              onClick={onClose}
              className='text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl'
            >
              ✕
            </button>
          </div>

          {/* 이미지 */}
          {listing.image && (
            <div className='mb-6'>
              <img
                src={listing.image}
                alt={listing.name}
                className='w-full h-96 object-contain rounded-lg bg-gray-100 dark:bg-gray-700'
                onError={(e) => {
                  console.error('이미지 로드 실패:', listing.image)
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          )}

          {/* 기본 정보 */}
          <div className='space-y-4 mb-6'>
            <div>
              <h3 className='text-sm font-medium text-gray-600 dark:text-gray-400 mb-1'>
                Token ID
              </h3>
              <p className='text-lg font-mono'>{listing.tokenId.toString()}</p>
            </div>

            <div>
              <h3 className='text-sm font-medium text-gray-600 dark:text-gray-400 mb-1'>
                가격
              </h3>
              <p className='text-2xl font-bold text-green-600 dark:text-green-400'>
                {formatTokenAmount(listing.price, 18)} MTK
              </p>
            </div>

            {details?.owner && (
              <div>
                <h3 className='text-sm font-medium text-gray-600 dark:text-gray-400 mb-1'>
                  현재 소유자
                </h3>
                <div className='flex items-center gap-2'>
                  <code className='text-sm font-mono bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded'>
                    {details.owner}
                  </code>
                  <a
                    href={getAddressUrl(details.owner)}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-xs text-blue-500 hover:text-blue-600'
                  >
                    Etherscan ↗
                  </a>
                </div>
              </div>
            )}

            {listing.seller && (
              <div>
                <h3 className='text-sm font-medium text-gray-600 dark:text-gray-400 mb-1'>
                  판매자
                </h3>
                <div className='flex items-center gap-2'>
                  <code className='text-sm font-mono bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded'>
                    {listing.seller}
                  </code>
                  <a
                    href={getAddressUrl(listing.seller)}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-xs text-blue-500 hover:text-blue-600'
                  >
                    Etherscan ↗
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* 설명 */}
          {details?.description && (
            <div className='mb-6'>
              <h3 className='text-sm font-medium text-gray-600 dark:text-gray-400 mb-2'>
                설명
              </h3>
              <p className='text-gray-700 dark:text-gray-300 whitespace-pre-wrap'>
                {details.description}
              </p>
            </div>
          )}

          {/* 속성 */}
          {details?.attributes && details.attributes.length > 0 && (
            <div className='mb-6'>
              <h3 className='text-sm font-medium text-gray-600 dark:text-gray-400 mb-2'>
                속성
              </h3>
              <div className='grid grid-cols-2 gap-2'>
                {details.attributes.map((attr: any, index: number) => (
                  <div
                    key={index}
                    className='p-3 bg-gray-50 dark:bg-gray-700 rounded-lg'
                  >
                    <p className='text-xs text-gray-500 dark:text-gray-400 mb-1'>
                      {attr.trait_type || '속성'}
                    </p>
                    <p className='text-sm font-semibold'>{attr.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className='flex gap-3 pt-4 border-t'>
            {isOwner ? (
              <button
                onClick={() => {
                  onCancel(listing.tokenId)
                  onClose()
                }}
                className='flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600'
              >
                판매 취소
              </button>
            ) : (
              <button
                onClick={() => {
                  onBuy(listing.tokenId, listing.price)
                  onClose()
                }}
                className='flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600'
              >
                구매하기
              </button>
            )}
            <a
              href={getEtherscanUrl(listing.tokenId)}
              target='_blank'
              rel='noopener noreferrer'
              className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-center'
            >
              Etherscan ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
