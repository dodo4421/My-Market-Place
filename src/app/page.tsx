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
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
      {/* 헤더 */}
      <header className='bg-white dark:bg-gray-800 shadow-sm'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4'>
          <div className='flex justify-between items-center'>
            <h1 className='text-2xl font-bold'>92015415 장재원의 NFT마켓</h1>
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <nav className='bg-white dark:bg-gray-800 border-b'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex space-x-8'>
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`py-4 px-1 border-b-2 font-bold text-base ${
                activeTab === 'marketplace'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              마켓플레이스
            </button>
            <button
              onClick={() => setActiveTab('mynft')}
              className={`py-4 px-1 border-b-2 font-bold text-base ${
                activeTab === 'mynft'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              내 NFT
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-4 px-1 border-b-2 font-bold text-base ${
                activeTab === 'profile'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              내 프로필
            </button>
            <button
              onClick={() => setActiveTab('contracts')}
              className={`py-4 px-1 border-b-2 font-bold text-base ${
                activeTab === 'contracts'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              컨트랙트 정보
            </button>
          </div>
        </div>
      </nav>

      {/* 메인 컨텐츠 */}
      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* 탭별 컨텐츠 */}
        {activeTab === 'marketplace' && <Marketplace />}
        {activeTab === 'mynft' && <MyNFT />}
        {activeTab === 'profile' && <Profile />}
        {activeTab === 'contracts' && <ContractInfo />}
      </main>

      {/* 푸터 */}
      <footer className='bg-white dark:bg-gray-800 border-t mt-12'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
          <p className='text-center text-gray-500 dark:text-gray-400 text-sm'>
            Sepolia 테스트넷에서 운영 중
          </p>
        </div>
      </footer>
    </div>
  )
}
