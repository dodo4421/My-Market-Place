'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import {
  uploadFileToIPFS,
  uploadMetadataToIPFS,
  getIPFSUrl,
  getIPFSGatewayUrl,
} from '@/lib/ipfs'
import { mintNFT } from '@/lib/contracts'

type Props = {
  onMinted?: (info: { to: `0x${string}`; tokenURI: string; txHash: `0x${string}` }) => void
}

export function MintNFT({ onMinted }: Props) {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()

  const [toAddress, setToAddress] = useState<string>('') 
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [isMinting, setIsMinting] = useState(false)
  const [status, setStatus] = useState<string>('')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isConnected && address) {
      setToAddress(address)
    }
  }, [isConnected, address])

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

  const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr)

  const handleMint = async () => {
    if (!isConnected || !address) {
      setStatus('지갑을 연결해주세요.')
      return
    }

    if (!isValidAddress(toAddress)) {
      setStatus('오류: 올바른 수령 주소(0x...)를 입력해주세요.')
      return
    }

    if (!name || !description || !image) {
      setStatus('모든 필드를 입력해주세요.')
      return
    }

    setIsMinting(true)
    setStatus('')

    try {
      setStatus('이미지를 IPFS에 업로드하는 중...')
      const imageHash = await uploadFileToIPFS(image)
      const imageUrl = getIPFSGatewayUrl(imageHash)

      setStatus('메타데이터를 IPFS에 업로드하는 중...')
      const metadataHash = await uploadMetadataToIPFS({
        name,
        description,
        image: imageUrl,
      })
      const tokenURI = getIPFSUrl(metadataHash)

      setStatus('NFT를 민팅하는 중... (MetaMask 확인)')
      const receipt = await mintNFT(toAddress as `0x${string}`, tokenURI)

      const txHash = receipt.transactionHash as `0x${string}`
      setStatus(`성공! 트랜잭션 해시: ${txHash}`)

      onMinted?.({
        to: toAddress as `0x${string}`,
        tokenURI,
        txHash,
      })

      setName('')
      setDescription('')
      setImage(null)
      setImagePreview(null)
    } catch (error: any) {
      console.error('민팅 오류:', error)
      const msg = error?.shortMessage || error?.message || '알 수 없는 오류가 발생했습니다.'
      setStatus(`오류: ${msg}`)
    } finally {
      setIsMinting(false)
    }
  }

  const cardClass = 'p-8 bg-white/80 backdrop-blur-md rounded-3xl shadow-lg border border-emerald-50'

  if (!mounted) {
    return (
      <div className={cardClass}>
        <p className='text-emerald-500 text-center animate-pulse font-bold'>로딩 중...</p>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className='p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3'>
        <div className='p-2 bg-emerald-100 rounded-full text-emerald-600'>⚠️</div>
        <p className='text-emerald-800 font-medium'>
          NFT를 민팅하려면 먼저 지갑을 연결해주세요.
        </p>
      </div>
    )
  }

  return (
    <div className={cardClass}>
      <h2 className='text-2xl font-black mb-8 text-slate-800 flex items-center gap-3'>
        <span className='w-1.5 h-8 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-full'></span>
        NFT 발행하기
      </h2>

      <div className='space-y-6'>
        <div className='group'>
          <label className='block text-sm font-bold text-slate-600 mb-2'>수령 주소 (Address)</label>
          <input
            type='text'
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value.trim())}
            className='w-full px-4 py-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none font-mono text-sm text-slate-700 font-medium'
            placeholder='0x... (기본값: 내 지갑 주소)'
          />
        </div>

        <div className='group'>
          <label className='block text-sm font-bold text-slate-600 mb-2'>이름 (Name)</label>
          <input
            type='text'
            value={name}
            onChange={(e) => setName(e.target.value)}
            className='w-full px-4 py-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-slate-700 font-medium'
            placeholder='나만의 멋진 NFT 이름'
          />
        </div>

        <div className='group'>
          <label className='block text-sm font-bold text-slate-600 mb-2'>설명 (Description)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className='w-full px-4 py-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-slate-700 font-medium resize-none'
            placeholder='이 NFT에 대한 설명을 적어주세요'
            rows={4}
          />
        </div>

        <div className='group'>
          <label className='block text-sm font-bold text-slate-600 mb-2'>이미지 (Image)</label>
          <div className='relative overflow-hidden group-hover:border-emerald-400 transition-colors border-2 border-dashed border-emerald-100 rounded-2xl bg-emerald-50/30 p-8 text-center'>
             <input
              type='file'
              accept='image/*'
              onChange={handleImageChange}
              className='absolute inset-0 w-full h-full opacity-0 cursor-pointer'
            />
            {!imagePreview ? (
                <div className="flex flex-col items-center justify-center text-emerald-400/70">
                   <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                   <p className="text-sm font-bold">이미지 선택하기</p>
                </div>
            ) : (
               <img
                src={imagePreview}
                alt='미리보기'
                className='max-h-64 mx-auto rounded-lg shadow-md'
              />
            )}
            
          </div>
        </div>

        <button
          onClick={handleMint}
          disabled={
            isMinting ||
            !name ||
            !description ||
            !image ||
            !isValidAddress(toAddress)
          }
          className='w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-2xl shadow-md hover:shadow-lg hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all'
        >
          {isMinting ? '민팅 진행 중...' : 'NFT 민팅하기'}
        </button>

        {status && (
          <div
            className={`p-4 rounded-xl border text-sm font-bold whitespace-pre-wrap break-all text-center ${
              status.includes('성공')
                ? 'bg-green-50 border-green-200 text-green-700'
                : status.includes('오류')
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            {status}
          </div>
        )}
      </div>
    </div>
  )
}
