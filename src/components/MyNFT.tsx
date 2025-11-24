'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import {
  ownerOf,
  getTokenURI,
  getListing,
  getNFTOwner,
  balanceOf,
  listNFT,
  approveNFT,
  cancelListing,
  parseTokenAmount,
  formatTokenAmount,
  getTokenDecimals,
  getTokenSymbol,
} from '@/lib/contracts'
import { marketplaceContractAddress } from '@/lib/constants'
import { getIPFSGatewayUrl } from '@/lib/ipfs'
import { MintNFTModal } from './MintNFTModal'

interface NFTInfo {
  tokenId: bigint
  name?: string
  description?: string
  image?: string
  isListed?: boolean
  listingPrice?: bigint
}

export function MyNFT() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()
  const [nfts, setNfts] = useState<NFTInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [maxTokenId, setMaxTokenId] = useState(100)
  const [isOwner, setIsOwner] = useState(false)
  const [showMintModal, setShowMintModal] = useState(false)
  const [nftBalance, setNftBalance] = useState<bigint>(BigInt(0))
  const [selectedNFT, setSelectedNFT] = useState<NFTInfo | null>(null)
  const [nftDetails, setNftDetails] = useState<{
    description?: string
    attributes?: any[]
    owner?: string
  } | null>(null)
  const [status, setStatus] = useState<string>('')
  const [tokenDecimals, setTokenDecimals] = useState<number>(18)
  const [tokenSymbol, setTokenSymbol] = useState<string>('MTK')

  // 클라이언트에서만 마운트되도록 처리
  useEffect(() => {
    setMounted(true)
  }, [])

  // IPFS URL을 게이트웨이 URL로 변환
  const convertIPFSUrl = (url: string): string => {
    if (url.startsWith('ipfs://')) {
      const hash = url.replace('ipfs://', '')
      return getIPFSGatewayUrl(hash)
    }
    return url
  }

  // NFT 메타데이터 가져오기
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

  // 컨트랙트 소유자 확인
  const checkOwner = async () => {
    if (!isConnected || !address) return

    try {
      const contractOwner = await getNFTOwner()
      setIsOwner(contractOwner.toLowerCase() === address.toLowerCase())
    } catch (error) {
      console.error('소유자 확인 오류:', error)
      setIsOwner(false)
    }
  }

  // NFT 상세 정보 가져오기
  const fetchNFTDetails = async (nft: NFTInfo) => {
    try {
      const tokenURI = await getTokenURI(nft.tokenId)
      let url = tokenURI
      if (tokenURI.startsWith('ipfs://')) {
        const hash = tokenURI.replace('ipfs://', '')
        url = getIPFSGatewayUrl(hash)
      }

      const response = await fetch(url)
      if (response.ok) {
        const metadata = await response.json()
        const owner = await ownerOf(nft.tokenId)

        setNftDetails({
          description: metadata.description,
          attributes: metadata.attributes,
          owner: owner,
        })
      }
    } catch (error) {
      console.error('NFT 상세 정보 가져오기 오류:', error)
      setNftDetails(null)
    }
  }

  // NFT 카드 클릭 핸들러
  const handleNFTClick = async (nft: NFTInfo) => {
    setSelectedNFT(nft)
    await fetchNFTDetails(nft)
  }

  // 토큰 정보 조회
  const fetchTokenInfo = async () => {
    if (!isConnected || !address) return

    try {
      const [decimals, symbol] = await Promise.all([
        getTokenDecimals(),
        getTokenSymbol(),
      ])

      setTokenDecimals(decimals)
      setTokenSymbol(symbol)
    } catch (error: any) {
      console.error('토큰 정보 조회 오류:', error)
    }
  }

  // 판매 등록 핸들러
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
      await fetchMyNFTs()

      setTimeout(() => setStatus(''), 5000)
    } catch (error: any) {
      console.error('판매 등록 오류:', error)
      setStatus(`판매 등록 실패: ${error.message || '알 수 없는 오류'}`)
      setTimeout(() => setStatus(''), 5000)
    }
  }

  // 판매 취소 핸들러
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
      await fetchMyNFTs()

      setTimeout(() => setStatus(''), 5000)
    } catch (error: any) {
      console.error('판매 취소 오류:', error)
      setStatus(`판매 취소 실패: ${error.message || '알 수 없는 오류'}`)
      setTimeout(() => setStatus(''), 5000)
    }
  }

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

  // 보유 NFT 조회 (최적화: 병렬 처리)
  const fetchMyNFTs = async () => {
    if (!isConnected || !address) return

    setIsLoading(true)

    try {
      // NFT 잔액 조회
      const balance = await balanceOf(address)
      setNftBalance(balance)

      // 1단계: 모든 토큰 ID의 소유자를 병렬로 확인 (배치 처리)
      const tokenIds = Array.from({ length: maxTokenId + 1 }, (_, i) =>
        BigInt(i)
      )

      const ownedTokens: bigint[] = []
      await processBatch(tokenIds, 20, async (tokenId) => {
        try {
          const owner = await ownerOf(tokenId)
          if (owner.toLowerCase() === address.toLowerCase()) {
            return tokenId
          }
        } catch {
          // 토큰이 존재하지 않음
        }
        return null
      }).then((results) => {
        ownedTokens.push(...results)
      })

      if (ownedTokens.length === 0) {
        setNfts([])
        setIsLoading(false)
        return
      }

      // 2단계: 소유한 NFT의 메타데이터와 리스팅 정보를 병렬로 조회
      const nftPromises = ownedTokens.map(async (tokenId): Promise<NFTInfo> => {
        const tokenIdNum = Number(tokenId)
        let name: string | undefined
        let description: string | undefined
        let image: string | undefined
        let isListed = false
        let listingPrice: bigint | undefined

        // 메타데이터와 리스팅 정보를 병렬로 조회
        const [metadataResult, listingResult] = await Promise.allSettled([
          (async () => {
            try {
              const tokenURI = await getTokenURI(tokenId)
              return await fetchMetadata(tokenURI)
            } catch {
              return null
            }
          })(),
          (async () => {
            try {
              return await getListing(tokenId)
            } catch {
              return null
            }
          })(),
        ])

        if (metadataResult.status === 'fulfilled' && metadataResult.value) {
          name = metadataResult.value.name
          description = metadataResult.value.description
          image = metadataResult.value.image
        }

        if (listingResult.status === 'fulfilled' && listingResult.value) {
          const listing = listingResult.value
          if (listing.isListed) {
            isListed = true
            listingPrice = listing.price
          }
        }

        return {
          tokenId,
          name: name || `NFT #${tokenIdNum}`,
          description,
          image,
          isListed,
          listingPrice,
        }
      })

      const myNFTsList = await Promise.all(nftPromises)
      setNfts(myNFTsList)
    } catch (error) {
      console.error('내 NFT 조회 오류:', error)
      setNfts([])
    }

    setIsLoading(false)
  }

  useEffect(() => {
    if (mounted && isConnected) {
      checkOwner()
      fetchMyNFTs()
      fetchTokenInfo()
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
          NFT를 보려면 먼저 지갑을 연결해주세요.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {/* 헤더 */}
      <div className='flex justify-between items-center'>
        <div>
          <h2 className='text-2xl font-bold'>내 NFT</h2>
          <p className='text-gray-600 dark:text-gray-400 mt-1'>
            보유 중인 NFT: {nfts.length}개
          </p>
        </div>
        <div className='flex gap-2'>
          {isOwner && (
            <button
              onClick={() => setShowMintModal(true)}
              className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600'
            >
              새로운 NFT 등록
            </button>
          )}
          <button
            onClick={() => {
              fetchMyNFTs()
              checkOwner()
              fetchTokenInfo()
            }}
            disabled={isLoading}
            className='px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50'
          >
            {isLoading ? '로딩 중...' : '새로고침'}
          </button>
        </div>
      </div>

      {/* 상태 메시지 */}
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

      {/* NFT 목록 */}
      {isLoading ? (
        <p className='text-gray-500'>로딩 중...</p>
      ) : nfts.length === 0 ? (
        <div className='p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center'>
          <p className='text-gray-500 dark:text-gray-400'>
            보유한 NFT가 없습니다.
          </p>
          {isOwner && (
            <button
              onClick={() => setShowMintModal(true)}
              className='mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600'
            >
              새로운 NFT 등록
            </button>
          )}
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {nfts.map((nft) => (
            <NFTCard
              key={nft.tokenId.toString()}
              nft={nft}
              onClick={() => handleNFTClick(nft)}
              onList={handleList}
              onCancel={handleCancel}
              tokenDecimals={tokenDecimals}
            />
          ))}
        </div>
      )}

      {/* 민팅 모달 */}
      {showMintModal && isOwner && (
        <MintNFTModal
          onClose={() => {
            setShowMintModal(false)
          }}
          onSuccess={() => {
            setShowMintModal(false)
            fetchMyNFTs()
          }}
        />
      )}

      {/* NFT 상세 정보 모달 */}
      {selectedNFT && (
        <NFTDetailModal
          nft={selectedNFT}
          details={nftDetails}
          onClose={() => {
            setSelectedNFT(null)
            setNftDetails(null)
          }}
        />
      )}
    </div>
  )
}

// NFT 카드 컴포넌트
function NFTCard({
  nft,
  onClick,
  onList,
  onCancel,
  tokenDecimals,
}: {
  nft: NFTInfo
  onClick: () => void
  onList: (tokenId: bigint, price: string) => void
  onCancel: (tokenId: bigint) => void
  tokenDecimals: number
}) {
  const [price, setPrice] = useState('')
  const [isListing, setIsListing] = useState(false)
  const [showListForm, setShowListForm] = useState(false)

  const getEtherscanUrl = (tokenId: bigint) => {
    return `https://sepolia.etherscan.io/token/0xDa3f9D3950e8e274a9e61c5FC55a632D64f2Ec69?a=${tokenId.toString()}`
  }

  const handleSubmit = () => {
    if (!price || parseFloat(price) <= 0) {
      alert('올바른 가격을 입력해주세요.')
      return
    }
    setIsListing(true)
    onList(nft.tokenId, price)
    setIsListing(false)
    setPrice('')
    setShowListForm(false)
  }

  return (
    <div className='p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-shadow'>
      <div onClick={onClick} className='cursor-pointer'>
        {nft.image ? (
          <div className='mb-4'>
            <img
              src={nft.image}
              alt={nft.name}
              className='w-full h-48 object-cover rounded-lg'
              onError={(e) => {
                console.error('이미지 로드 실패:', nft.image)
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
        ) : (
          <div className='mb-4 w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center'>
            <p className='text-gray-400 text-sm'>이미지 없음</p>
          </div>
        )}

        <h4 className='font-semibold text-lg mb-2'>{nft.name}</h4>

        {nft.description && (
          <p className='text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2'>
            {nft.description}
          </p>
        )}

        <div className='space-y-2'>
          <p className='text-xs text-gray-500'>
            Token ID: {nft.tokenId.toString()}
          </p>

          {nft.isListed && nft.listingPrice && (
            <div className='p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded'>
              <p className='text-xs text-yellow-800 dark:text-yellow-200'>
                판매 중: {formatTokenAmount(nft.listingPrice, tokenDecimals)}{' '}
                MTK
              </p>
            </div>
          )}
        </div>
      </div>

      <div className='mt-4'>
        {nft.isListed ? (
          <div className='flex gap-1.5'>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCancel(nft.tokenId)
              }}
              className='flex-1 px-2 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 text-xs'
            >
              판매 취소
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClick()
              }}
              className='px-2 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs'
            >
              상세보기
            </button>
            <a
              href={getEtherscanUrl(nft.tokenId)}
              target='_blank'
              rel='noopener noreferrer'
              onClick={(e) => e.stopPropagation()}
              className='px-2 py-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs text-center'
            >
              Etherscan ↗
            </a>
          </div>
        ) : (
          <>
            {!showListForm ? (
              <div className='flex gap-1.5'>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowListForm(true)
                  }}
                  className='flex-1 px-2 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 text-xs'
                >
                  판매 등록
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onClick()
                  }}
                  className='px-2 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs'
                >
                  상세보기
                </button>
                <a
                  href={getEtherscanUrl(nft.tokenId)}
                  target='_blank'
                  rel='noopener noreferrer'
                  onClick={(e) => e.stopPropagation()}
                  className='px-2 py-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs text-center'
                >
                  Etherscan ↗
                </a>
              </div>
            ) : (
              <div className='space-y-2'>
                <input
                  type='number'
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder='가격 (MTK)'
                  className='w-full px-2 py-1.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-xs'
                  step='0.01'
                  min='0'
                  onClick={(e) => e.stopPropagation()}
                />
                <div className='flex gap-1.5'>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSubmit()
                    }}
                    disabled={isListing || !price}
                    className='flex-1 px-2 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-xs'
                  >
                    {isListing ? '등록 중...' : '등록'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowListForm(false)
                      setPrice('')
                    }}
                    className='px-2 py-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs'
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// NFT 상세 정보 모달 컴포넌트 (MyNFT용)
function NFTDetailModal({
  nft,
  details,
  onClose,
}: {
  nft: NFTInfo
  details: {
    description?: string
    attributes?: any[]
    owner?: string
  } | null
  onClose: () => void
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
              {nft.name || `NFT #${nft.tokenId.toString()}`}
            </h2>
            <button
              onClick={onClose}
              className='text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl'
            >
              ✕
            </button>
          </div>

          {/* 이미지 */}
          {nft.image && (
            <div className='mb-6'>
              <img
                src={nft.image}
                alt={nft.name}
                className='w-full h-96 object-contain rounded-lg bg-gray-100 dark:bg-gray-700'
                onError={(e) => {
                  console.error('이미지 로드 실패:', nft.image)
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
              <p className='text-lg font-mono'>{nft.tokenId.toString()}</p>
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

            {nft.isListed && nft.listingPrice && (
              <div>
                <h3 className='text-sm font-medium text-gray-600 dark:text-gray-400 mb-1'>
                  판매 가격
                </h3>
                <p className='text-2xl font-bold text-yellow-600 dark:text-yellow-400'>
                  {nft.listingPrice.toString()} MTK
                </p>
                <p className='text-xs text-yellow-600 dark:text-yellow-400 mt-1'>
                  판매 중
                </p>
              </div>
            )}
          </div>

          {/* 설명 */}
          {(details?.description || nft.description) && (
            <div className='mb-6'>
              <h3 className='text-sm font-medium text-gray-600 dark:text-gray-400 mb-2'>
                설명
              </h3>
              <p className='text-gray-700 dark:text-gray-300 whitespace-pre-wrap'>
                {details?.description || nft.description}
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
            <a
              href={getEtherscanUrl(nft.tokenId)}
              target='_blank'
              rel='noopener noreferrer'
              className='flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-center'
            >
              Etherscan에서 보기 ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
