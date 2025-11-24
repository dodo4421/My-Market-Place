import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 1. 서버 외부 패키지 설정 (기존 유지)
  serverExternalPackages: ['thread-stream', 'pino', '@metamask/sdk'],

  // 2. Turbopack 및 experimental 설정 삭제
  // (이 부분이 있으면 Webpack 설정이 무시되므로 과감히 지웁니다)

  // 3. Webpack 설정 (안정적으로 모듈 무시 가능)
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // 사용하지 않는 패키지들을 'false'로 설정하여 빌드에서 아예 제외시킵니다.
      '@metamask/sdk': false,
      '@safe-global/safe-apps-provider': false,
      '@safe-global/safe-apps-sdk': false,
      '@walletconnect/ethereum-provider': false,
      porto: false,
    }
    return config
  },
}

export default nextConfig
