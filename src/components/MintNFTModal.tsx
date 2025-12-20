'use client'

import { MintNFT } from './MintNFT'

type Props = {
  onClose: () => void
  onSuccess?: () => void
}

export function MintNFTModal({ onClose, onSuccess }: Props) {
  return (
    <div className='w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-fadeIn'>
       <div className='p-2 bg-gradient-to-r from-emerald-500 to-teal-500 flex justify-between items-center px-6 py-4'>
           <h3 className='text-white font-bold text-lg'>새로운 NFT 만들기</h3>
           <button 
              onClick={onClose}
              className='text-white/80 hover:text-white transition-colors'
           >
              닫기
           </button>
       </div>
       <div className="max-h-[80vh] overflow-y-auto">
          <MintNFT onMinted={() => {
             if(onSuccess) onSuccess()
          }} />
       </div>
    </div>
  )
}
