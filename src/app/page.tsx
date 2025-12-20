'use client'

import { WalletConnect } from '@/components/WalletConnect'
import { MyNFT } from '@/components/MyNFT'
import { Marketplace } from '@/components/Marketplace'
import { Profile } from '@/components/Profile'
import { ContractInfo } from '@/components/ContractInfo'
import { useState } from 'react'

export default function Home() {
  const [activeTab, setActiveTab] = useState<
    'marketplace' | 'mynft' | 'profile' | 'contracts'
  >('marketplace')

  return (
    <div className='min-h-screen text-slate-900 font-sans selection:bg-emerald-100'>
      {/* Premium Header */}
      <header className='sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-emerald-100'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
           <div className='h-20 flex items-center justify-between'>
             {/* Title */}
             <div className="flex items-center gap-2">
               <h1 className='text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-900 to-teal-700 tracking-tight'>
                 92015415 장재원의 NFT마켓
               </h1>
             </div>
             
             {/* Wallet */}
             <WalletConnect />
           </div>

           {/* Navigation Tabs */}
           <nav className='flex space-x-8 -mb-px'>
            <TabButton 
              label="마켓플레이스" 
              isActive={activeTab === 'marketplace'} 
              onClick={() => setActiveTab('marketplace')} 
            />
            <TabButton 
              label="내 NFT" 
              isActive={activeTab === 'mynft'} 
              onClick={() => setActiveTab('mynft')} 
            />
            <TabButton 
              label="내 프로필" 
              isActive={activeTab === 'profile'} 
              onClick={() => setActiveTab('profile')} 
            />
            <TabButton 
              label="컨트랙트 정보" 
              isActive={activeTab === 'contracts'} 
              onClick={() => setActiveTab('contracts')} 
            />
           </nav>
        </div>
      </header>

      {/* Main Content Space */}
      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fadeIn'>
        {activeTab === 'marketplace' && <Marketplace />}
        {activeTab === 'mynft' && <MyNFT />}
        {activeTab === 'profile' && <Profile />}
        {activeTab === 'contracts' && <ContractInfo />}
      </main>

      {/* Elegant Footer */}
      <footer className='bg-emerald-50 border-t border-emerald-100 mt-20'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="text-center md:text-left">
               <p className='font-bold text-emerald-800'>My NFT Market</p>
               <p className='text-sm text-emerald-600 mt-1'>
                 Premium NFT Trading Platform on Sepolia
               </p>
             </div>
             <p className='text-emerald-500 text-sm'>
               © 2024 Jang Jaewon. All rights reserved.
             </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function TabButton({ label, isActive, onClick }: { label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        py-4 px-1 border-b-[3px] font-bold text-sm transition-all duration-200
        ${isActive 
          ? 'border-emerald-500 text-emerald-600' 
          : 'border-transparent text-slate-500 hover:text-emerald-700 hover:border-emerald-200'
        }
      `}
    >
      {label}
    </button>
  )
}
