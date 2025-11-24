import { createConfig, http, fallback } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { SEPOLIA_RPC_URLS } from './constants'

// Sepolia 테스트넷 설정
const chains = [sepolia] as const

// wagmi 설정 생성
// WalletConnect Project ID가 설정된 경우에만 WalletConnect connector 추가
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

// 브라우저 환경에서만 MetaMask와 WalletConnect connector 추가 (서버 사이드 렌더링 방지)
const isBrowser = typeof window !== 'undefined'

// Connector를 동적으로 생성하는 함수
function getConnectors() {
  const connectors = [injected()]

  // 브라우저 환경에서만 추가 connector 로드
  if (isBrowser) {
    try {
      // MetaMask connector는 injected()에 포함되므로 별도로 추가하지 않음
      // 필요시 동적으로 import할 수 있음

      // WalletConnect Project ID가 유효한 경우에만 추가
      if (walletConnectProjectId && walletConnectProjectId.trim() !== '') {
        const { walletConnect } = require('wagmi/connectors')
        connectors.push(
          walletConnect({
            projectId: walletConnectProjectId,
          })
        )
      }
    } catch (error) {
      console.warn('Connector 로드 실패:', error)
    }
  }

  return connectors
}

const connectors = getConnectors()

// RPC 엔드포인트 설정 (타임아웃 및 재시도 포함)
const sepoliaTransports = SEPOLIA_RPC_URLS.map((url) =>
  http(url, {
    timeout: 10000, // 10초 타임아웃
    retryCount: 2, // 2번 재시도
    retryDelay: 1000, // 1초 대기 후 재시도
  })
)

export const wagmiConfig = createConfig({
  chains,
  connectors,
  transports: {
    [sepolia.id]: fallback(sepoliaTransports), // 여러 RPC를 fallback으로 사용
  },
})
