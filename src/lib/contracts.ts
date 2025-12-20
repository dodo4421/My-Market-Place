import { parseUnits, formatUnits } from 'viem'
import {
  readContract,
  writeContract,
  waitForTransactionReceipt,
} from '@wagmi/core'
import { wagmiConfig } from './wagmi'
import {
  nftContractAddress,
  marketplaceContractAddress,
  tokenContractAddress,
} from './constants'
import nftAbi from './nftAbi.json'
import marketplaceAbi from './marketplaceAbi.json'
import tokenAbi from './tokenAbi.json'

/* =========================
   NFT 컨트랙트 함수들
========================= */

export async function mintNFT(to: `0x${string}`, tokenURI: string) {
  const hash = await writeContract(wagmiConfig, {
    address: nftContractAddress as `0x${string}`,
    abi: nftAbi,
    functionName: 'safeMint',
    args: [to, tokenURI],
  })

  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
  return receipt
}

export async function getTokenURI(tokenId: bigint): Promise<string> {
  const result = await readContract(wagmiConfig, {
    address: nftContractAddress as `0x${string}`,
    abi: nftAbi,
    functionName: 'tokenURI',
    args: [tokenId],
  })
  return result as string
}

export async function ownerOf(tokenId: bigint): Promise<`0x${string}`> {
  const result = await readContract(wagmiConfig, {
    address: nftContractAddress as `0x${string}`,
    abi: nftAbi,
    functionName: 'ownerOf',
    args: [tokenId],
  })
  return result as `0x${string}`
}

export async function balanceOf(owner: `0x${string}`): Promise<bigint> {
  const result = await readContract(wagmiConfig, {
    address: nftContractAddress as `0x${string}`,
    abi: nftAbi,
    functionName: 'balanceOf',
    args: [owner],
  })
  return result as bigint
}

export async function getNFTOwner(): Promise<`0x${string}`> {
  const result = await readContract(wagmiConfig, {
    address: nftContractAddress as `0x${string}`,
    abi: nftAbi,
    functionName: 'owner',
  })
  return result as `0x${string}`
}

export async function getApproved(tokenId: bigint): Promise<`0x${string}`> {
  const result = await readContract(wagmiConfig, {
    address: nftContractAddress as `0x${string}`,
    abi: nftAbi,
    functionName: 'getApproved',
    args: [tokenId],
  })
  return result as `0x${string}`
}

export async function isApprovedForAll(
  owner: `0x${string}`,
  operator: `0x${string}`
): Promise<boolean> {
  const result = await readContract(wagmiConfig, {
    address: nftContractAddress as `0x${string}`,
    abi: nftAbi,
    functionName: 'isApprovedForAll',
    args: [owner, operator],
  })
  return result as boolean
}

export async function approveNFT(spender: `0x${string}`, tokenId: bigint) {
  const hash = await writeContract(wagmiConfig, {
    address: nftContractAddress as `0x${string}`,
    abi: nftAbi,
    functionName: 'approve',
    args: [spender, tokenId],
  })

  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
  return receipt
}

export async function setApprovalForAllNFT(
  spender: `0x${string}`,
  approved: boolean
) {
  const hash = await writeContract(wagmiConfig, {
    address: nftContractAddress as `0x${string}`,
    abi: nftAbi,
    functionName: 'setApprovalForAll',
    args: [spender, approved],
  })

  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
  return receipt
}

/* =========================
   마켓플레이스 컨트랙트 함수들
========================= */

export async function listNFT(tokenId: bigint, price: bigint) {
  const hash = await writeContract(wagmiConfig, {
    address: marketplaceContractAddress as `0x${string}`,
    abi: marketplaceAbi,
    functionName: 'listNFT',
    args: [tokenId, price],
  })

  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
  return receipt
}

export async function buyNFT(tokenId: bigint) {
  const hash = await writeContract(wagmiConfig, {
    address: marketplaceContractAddress as `0x${string}`,
    abi: marketplaceAbi,
    functionName: 'buyNFT',
    args: [tokenId],
  })

  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
  return receipt
}

export async function cancelListing(tokenId: bigint) {
  const hash = await writeContract(wagmiConfig, {
    address: marketplaceContractAddress as `0x${string}`,
    abi: marketplaceAbi,
    functionName: 'cancelListing',
    args: [tokenId],
  })

  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
  return receipt
}

export async function getListing(tokenId: bigint) {
  const result = (await readContract(wagmiConfig, {
    address: marketplaceContractAddress as `0x${string}`,
    abi: marketplaceAbi,
    functionName: 'getListing',
    args: [tokenId],
  })) as [bigint, `0x${string}`, boolean]

  return {
    price: result[0],
    seller: result[1],
    isListed: result[2],
  }
}

/* =========================
   토큰(MyToken) 컨트랙트 함수들
========================= */

export async function approveToken(spender: `0x${string}`, amount: bigint) {
  const hash = await writeContract(wagmiConfig, {
    address: tokenContractAddress as `0x${string}`,
    abi: tokenAbi,
    functionName: 'approve',
    args: [spender, amount],
  })

  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
  return receipt
}

export async function getTokenBalance(owner: `0x${string}`): Promise<bigint> {
  const result = await readContract(wagmiConfig, {
    address: tokenContractAddress as `0x${string}`,
    abi: tokenAbi,
    functionName: 'balanceOf',
    args: [owner],
  })
  return result as bigint
}

export async function getTokenDecimals(): Promise<number> {
  const result = await readContract(wagmiConfig, {
    address: tokenContractAddress as `0x${string}`,
    abi: tokenAbi,
    functionName: 'decimals',
  })
  return Number(result)
}

export async function getTokenSymbol(): Promise<string> {
  const result = await readContract(wagmiConfig, {
    address: tokenContractAddress as `0x${string}`,
    abi: tokenAbi,
    functionName: 'symbol',
  })
  return result as string
}

export async function getTokenAllowance(
  owner: `0x${string}`,
  spender: `0x${string}`
): Promise<bigint> {
  const result = await readContract(wagmiConfig, {
    address: tokenContractAddress as `0x${string}`,
    abi: tokenAbi,
    functionName: 'allowance',
    args: [owner, spender],
  })
  return result as bigint
}

export async function transferToken(to: `0x${string}`, amount: bigint) {
  const hash = await writeContract(wagmiConfig, {
    address: tokenContractAddress as `0x${string}`,
    abi: tokenAbi,
    functionName: 'transfer',
    args: [to, amount],
  })

  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
  return receipt
}

/* =========================
   ✅ Faucet (토큰 드랍) 함수
========================= */

export async function requestTokenDrop() {
  const hash = await writeContract(wagmiConfig, {
    address: tokenContractAddress as `0x${string}`,
    abi: tokenAbi,
    functionName: 'requestTokens',
    args: [],
  })

  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
  return receipt
}

/* =========================
   유틸리티 함수
========================= */

export function parseTokenAmount(
  amount: string,
  decimals: number = 18
): bigint {
  return parseUnits(amount, decimals)
}

export function formatTokenAmount(
  amount: bigint,
  decimals: number = 18
): string {
  return formatUnits(amount, decimals)
}
