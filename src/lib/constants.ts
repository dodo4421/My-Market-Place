export const tokenContractAddress = '0x9858Ecd67e55B5649ef6b4A7948e6A0C5351b8cf'
export const SEPOLIA_CHAIN_ID = 11155111

// Sepolia RPC 엔드포인트 (fallback 포함)
// 환경 변수로 커스텀 RPC URL을 설정할 수 있습니다
// NEXT_PUBLIC_SEPOLIA_RPC_URL이 설정되어 있으면 우선 사용하고, 없으면 fallback 사용
const customRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL

export const SEPOLIA_RPC_URL = customRpcUrl || 'https://rpc.sepolia.org'

// 환경 변수가 설정되어 있으면 그것을 우선 사용하고, 추가 fallback 제공
export const SEPOLIA_RPC_URLS = customRpcUrl
  ? [
      customRpcUrl, // 사용자가 설정한 Infura API 키 포함 RPC URL (우선 사용)
      'https://rpc.sepolia.org', // fallback 1
      'https://ethereum-sepolia-rpc.publicnode.com', // fallback 2
      'https://rpc2.sepolia.org', // fallback 3
    ]
  : [
      'https://rpc.sepolia.org', // 기본값
      'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', // 공개 Infura 엔드포인트
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://rpc2.sepolia.org',
    ]

export const nftContractAddress = '0x767C463B781fe7be52228e90D041B818e32bb8d4'

export const marketplaceContractAddress =
  '0xbEa5a62bFB64a92D3B5C13067DD5de4cDcaB09Cf'

export const SEPOLIA_NETWORK = {
  chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}`,
  chainName: 'Sepolia',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://sepolia.infura.io/v3/'],
  blockExplorerUrls: ['https://sepolia.etherscan.io/'],
}
