'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import {
  uploadFileToIPFS,
  uploadMetadataToIPFS,
  getIPFSUrl,
  getIPFSGatewayUrl,
} from '@/lib/ipfs'
import { mintNFT } from '@/lib/contracts'

interface MintNFTModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function MintNFTModal({ onClose, onSuccess }: MintNFTModalProps) {
  const { address, isConnected } = useAccount()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isMinting, setIsMinting] = useState(false)
  const [status, setStatus] = useState<string>('')

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleMint = async () => {
    if (!isConnected || !address) {
      setStatus('지갑을 연결해주세요.')
      return
    }

    if (!name || !description || !image) {
      setStatus('모든 필드를 입력해주세요.')
      return
    }

    setIsMinting(true)
    setStatus('')

    try {
      // 1. 이미지를 IPFS에 업로드
      setStatus('이미지를 IPFS에 업로드하는 중...')
      const imageHash = await uploadFileToIPFS(image)
      const imageUrl = getIPFSGatewayUrl(imageHash)

      // 2. 메타데이터 생성 및 IPFS에 업로드
      setStatus('메타데이터를 IPFS에 업로드하는 중...')
      const metadataHash = await uploadMetadataToIPFS({
        name,
        description,
        image: imageUrl,
      })
      const tokenURI = getIPFSUrl(metadataHash)

      // 3. NFT 민팅
      setStatus('NFT를 민팅하는 중...')
      const receipt = await mintNFT(address, tokenURI)

      setStatus(`성공! 트랜잭션 해시: ${receipt.transactionHash}`)

      // 폼 초기화
      setName('')
      setDescription('')
      setImage(null)
      setImagePreview(null)

      // 성공 콜백 호출
      setTimeout(() => {
        onSuccess()
      }, 2000)
    } catch (error: any) {
      console.error('민팅 오류:', error)
      setStatus(`오류: ${error.message || '알 수 없는 오류가 발생했습니다.'}`)
    } finally {
      setIsMinting(false)
    }
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-2xl font-bold'>NFT 민팅</h2>
          <button
            onClick={onClose}
            className='text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            disabled={isMinting}
          >
            ✕
          </button>
        </div>

        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium mb-2'>이름</label>
            <input
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              className='w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600'
              placeholder='NFT 이름을 입력하세요'
              disabled={isMinting}
            />
          </div>

          <div>
            <label className='block text-sm font-medium mb-2'>설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className='w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600'
              placeholder='NFT 설명을 입력하세요'
              rows={4}
              disabled={isMinting}
            />
          </div>

          <div>
            <label className='block text-sm font-medium mb-2'>이미지</label>
            <input
              type='file'
              accept='image/*'
              onChange={handleImageChange}
              className='w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600'
              disabled={isMinting}
            />
            {imagePreview && (
              <div className='mt-4'>
                <img
                  src={imagePreview}
                  alt='미리보기'
                  className='max-w-xs rounded-lg'
                />
              </div>
            )}
          </div>

          <button
            onClick={handleMint}
            disabled={isMinting || !name || !description || !image}
            className='w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {isMinting ? '민팅 중...' : 'NFT 민팅'}
          </button>

          {status && (
            <div
              className={`p-3 rounded-lg ${
                status.includes('성공')
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                  : status.includes('오류')
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                  : 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200'
              }`}
            >
              <p className='text-sm whitespace-pre-wrap'>{status}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
