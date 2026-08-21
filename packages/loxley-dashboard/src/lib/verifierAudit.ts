// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// What is actually being verified on a given deployment.
//
// The protocol's central claim is that every step is publicly checkable. On the
// deployments that exist today that claim is weaker than it reads: upstream's
// own docs say the Sepolia network was deployed with DEPLOY_MOCKS=true and
// without ENABLE_ZK_VERIFICATION, and that mainnet registers a
// DeployableMockCiphertextVerifier "intended for public-network rehearsal".
//
// So this reads the three verifier slots straight off the chain and reports
// them. It is deliberately capable of returning an unflattering answer — that
// is the only reason anyone should believe a flattering one.
//
// What it can and cannot tell you
//   Can:    which address sits in each slot, whether the slot is empty, and how
//           much bytecode lives there.
//   Cannot: whether a real-looking verifier is *sound*. Bytecode size is
//           evidence, not proof. A 12kB contract can still be wrong; a stub
//           that returns true cannot be right. Only the second conclusion is
//           safe to draw, and that is the only one drawn below.

import { createPublicClient, http, keccak256, toHex, type Address } from 'viem'
import { mainnet, sepolia } from 'viem/chains'
import { Loxley__factory } from '@loxley/contracts/types'

export type NetworkKey = 'sepolia' | 'mainnet'

export type NetworkTarget = {
  key: NetworkKey
  label: string
  /** Upstream Interfold's deployment. Loxley has none of its own yet. */
  loxley: Address
  explorer: string
  note: string
}

// Deze adressen zijn upstream Interfold, niet die van ons -- Loxley is nergens
// gedeployed. Ze staan hier zodat de checker vandaag iets echts te controleren
// heeft; ze worden in de UI ook als zodanig benoemd.
export const NETWORKS: NetworkTarget[] = [
  {
    key: 'mainnet',
    label: 'Ethereum mainnet',
    loxley: '0x28cF63B459e6218C69EA97ea7D90541cf648c715',
    explorer: 'https://etherscan.io',
    note: 'The Interfold, upstream. Their docs describe the registered ciphertext verifier as a deployable mock for public-network rehearsal.',
  },
  {
    key: 'sepolia',
    label: 'Sepolia',
    loxley: '0x782ed907c3141e4b49BB9CBb34E83a820e12B2D7',
    explorer: 'https://sepolia.etherscan.io',
    note: 'The Interfold, upstream. Their docs state this was deployed with DEPLOY_MOCKS=true and without ENABLE_ZK_VERIFICATION.',
  },
]

// De enige encryptie-scheme-id die de contracten vandaag gebruiken.
export const SCHEME_ID = keccak256(toHex('fhe.rs:BFV'))

export type SlotKey = 'ciphertext' | 'decryption' | 'pk'

export type Verdict = 'empty' | 'stub' | 'present' | 'unreadable'

export type SlotResult = {
  slot: SlotKey
  label: string
  /** Waar dit bewijs over gaat, in gewone taal. */
  covers: string
  address: Address | null
  codeSize: number | null
  verdict: Verdict
  detail: string
}

const ZERO = '0x0000000000000000000000000000000000000000'

// Het BN254-veldmodulus. Elke Groth16-achtige verifier op EVM rekent over deze
// curve en draagt de constante daarom letterlijk in zijn bytecode. Aanwezigheid
// is een veel specifieker signaal dan grootte: een stub die `return true` doet
// heeft geen enkele reden om dit getal bij zich te hebben.
//
// Afwezigheid bewijst niets over een andere curve, en aanwezigheid bewijst niet
// dat de verifier klopt. Beide voorbehouden staan in de UI.
const BN254_P = '30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47'
const BN254_R = '30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001'

// EIP-1967 implementatie-slot. Zonder deze stap zou elke proxy als "stub"
// gelezen worden: die draagt zelf geen veldconstanten maar delegeert naar een
// implementatie die dat wel doet. Dat is precies het soort vals alarm waar dit
// gereedschap zijn geloofwaardigheid mee zou verspelen.
const EIP1967_IMPL = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as const

async function resolveImplementation(client: ChainReader, address: Address): Promise<Address | null> {
  try {
    const raw = await client.getStorageAt({ address, slot: EIP1967_IMPL })
    if (!raw || raw.length < 66) return null
    const impl = ('0x' + raw.slice(-40)) as Address
    return impl.toLowerCase() === ZERO ? null : impl
  } catch {
    return null
  }
}

const SLOTS: { slot: SlotKey; label: string; covers: string; fn: string; takesScheme: boolean }[] = [
  {
    slot: 'ciphertext',
    label: 'Ciphertext verifier',
    covers: 'That the encrypted inputs submitted to an E3 are well formed, rather than junk that could corrupt the computation.',
    fn: 'getCiphertextVerifier',
    takesScheme: true,
  },
  {
    slot: 'decryption',
    label: 'Decryption verifier',
    covers: 'That the published plaintext really is the decryption of that ciphertext — the step the whole result rests on.',
    fn: 'decryptionVerifiers',
    takesScheme: true,
  },
  {
    slot: 'pk',
    label: 'Public-key verifier',
    covers: 'That the committee’s aggregated public key was assembled honestly from the individual shares (circuit C5).',
    fn: 'pkVerifiers',
    takesScheme: true,
  },
]

// Precies de drie calls die deze module doet, in plaats van viem's volledige
// PublicClient-generic. Dat type is zo diep dat tsc er op afknapt (TS2589), en
// we hebben er hier niets van nodig.
type ChainReader = {
  readContract: (args: unknown) => Promise<unknown>
  getCode: (args: { address: Address }) => Promise<string | undefined>
  getStorageAt: (args: { address: Address; slot: `0x${string}` }) => Promise<string | undefined>
  getBlockNumber: () => Promise<bigint>
}

export function clientFor(target: NetworkTarget, rpcOverride?: string): ChainReader {
  const chain = target.key === 'mainnet' ? mainnet : sepolia
  const fallback = target.key === 'mainnet' ? 'https://ethereum-rpc.publicnode.com' : 'https://ethereum-sepolia.publicnode.com'
  return createPublicClient({ chain, transport: http(rpcOverride || fallback, { batch: true }) }) as unknown as ChainReader
}

async function readSlot(client: ChainReader, loxley: Address, spec: (typeof SLOTS)[number]): Promise<SlotResult> {
  const base = { slot: spec.slot, label: spec.label, covers: spec.covers }
  let address: Address | null = null

  try {
    address = (await client.readContract({
      address: loxley,
      abi: Loxley__factory.abi,
      functionName: spec.fn,
      args: [SCHEME_ID],
    })) as Address
  } catch (e) {
    return {
      ...base,
      address: null,
      codeSize: null,
      verdict: 'unreadable',
      detail: `Could not read ${spec.fn}() — ${(e as Error).message.split('\n')[0]}`,
    }
  }

  if (!address || address.toLowerCase() === ZERO) {
    return {
      ...base,
      address: null,
      codeSize: 0,
      verdict: 'empty',
      detail: 'No verifier is registered for this scheme. Nothing is checked at this step.',
    }
  }

  let codeSize: number | null = null
  let rawCode: string | undefined
  try {
    rawCode = await client.getCode({ address })
    codeSize = rawCode && rawCode !== '0x' ? (rawCode.length - 2) / 2 : 0
  } catch {
    codeSize = null
  }

  if (codeSize === 0) {
    return { ...base, address, codeSize, verdict: 'empty', detail: 'An address is registered, but there is no contract at it.' }
  }
  if (codeSize === null) {
    return {
      ...base,
      address,
      codeSize,
      verdict: 'unreadable',
      detail: 'A contract is registered; its code could not be read from this RPC.',
    }
  }

  // Bytecode van de proxy zelf, plus dat van de implementatie als het er een is.
  let hex = (rawCode || '').toLowerCase()
  const impl = await resolveImplementation(client, address)
  let via = ''
  if (impl) {
    try {
      const implCode = await client.getCode({ address: impl })
      hex += (implCode || '').toLowerCase()
      via = ` It is a proxy; this reads through to its implementation at ${impl}.`
    } catch {
      via = ` It is a proxy to ${impl}, whose code could not be read.`
    }
  }
  const hasFieldConstants = hex.includes(BN254_P) || hex.includes(BN254_R)

  if (hasFieldConstants) {
    return {
      ...base,
      address,
      codeSize,
      verdict: 'present',
      detail: `${codeSize} bytes, and the BN254 field modulus is embedded in the bytecode — this contract does real elliptic-curve arithmetic.${via} Whether it checks the right circuit is beyond what can be read from chain.`,
    }
  }
  return {
    ...base,
    address,
    codeSize,
    verdict: 'stub',
    detail: `${codeSize} bytes, and no BN254 field constants anywhere in the bytecode.${via} A Groth16-style verifier cannot work without them, so this is not verifying one.`,
  }
}

export type AuditResult = {
  target: NetworkTarget
  slots: SlotResult[]
  blockNumber: bigint | null
  error: string | null
}

export async function auditNetwork(target: NetworkTarget, rpcOverride?: string): Promise<AuditResult> {
  const client = clientFor(target, rpcOverride)
  try {
    const [blockNumber, slots] = await Promise.all([
      client.getBlockNumber(),
      Promise.all(SLOTS.map((s) => readSlot(client, target.loxley, s))),
    ])
    return { target, slots, blockNumber, error: null }
  } catch (e) {
    return { target, slots: [], blockNumber: null, error: (e as Error).message.split('\n')[0] }
  }
}
