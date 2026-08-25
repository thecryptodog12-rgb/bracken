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

import { createPublicClient, defineChain, http, keccak256, toHex, type Address } from 'viem'

const ROBINHOOD_RPC = 'https://rpc.mainnet.chain.robinhood.com'

const ROBINHOOD = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ROBINHOOD_RPC] } },
  blockExplorers: { default: { name: 'Explorer', url: 'https://explorer.mainnet.chain.robinhood.com' } },
})
import { Bracken__factory } from '@bracken/contracts/types'

export type NetworkKey = 'robinhood'

export type NetworkTarget = {
  key: NetworkKey
  label: string
  /** Bracken's own core contract. Null until a deployment exists. */
  bracken: Address | null
  explorer: string
  /** Blockscout API, sleutelvrij. Levert de geverifieerde contractnaam en wie
   *  hem deployde -- directer bewijs dan wat uit bytecode af te leiden valt. */
  blockscout: string
  note: string
}

// Alleen onze eigen keten. Hier stonden twee Ethereum-deployments van een ander
// project: de checker had daarmee vandaag iets echts te lezen, maar het maakte
// van deze pagina een analyse van andermans contracten onder ons merk. Nu leest
// hij Bracken, of hij zegt dat er nog niets te lezen valt.
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>
const CORE = (env.VITE_BRACKEN_ADDRESS ?? '').trim()
const DEPLOYED = /^0x[0-9a-fA-F]{40}$/.test(CORE) && !/^0x0{40}$/.test(CORE)

export const NETWORKS: NetworkTarget[] = [
  {
    key: 'robinhood',
    label: 'Robinhood Chain',
    bracken: DEPLOYED ? (CORE as Address) : null,
    explorer: 'https://explorer.mainnet.chain.robinhood.com',
    blockscout: 'https://explorer.mainnet.chain.robinhood.com',
    note: 'Bracken on chain 4663.',
  },
]

// De enige encryptie-scheme-id die de contracten vandaag gebruiken.
export const SCHEME_ID = keccak256(toHex('fhe.rs:BFV'))

export type SlotKey = 'ciphertext' | 'decryption' | 'pk'

export type Verdict = 'empty' | 'stub' | 'present' | 'inconclusive' | 'unreadable'

export type Provenance = {
  /** Geverifieerde contractnaam volgens de explorer, als de bron ingediend is. */
  name: string | null
  creator: string | null
  creationTx: string | null
}

export type SlotResult = {
  slot: SlotKey
  label: string
  /** Waar dit bewijs over gaat, in gewone taal. */
  covers: string
  address: Address | null
  codeSize: number | null
  verdict: Verdict
  detail: string
  provenance: Provenance | null
}

// Wie zette dit contract erin, en hoe heet het volgens zijn eigen geverifieerde
// broncode. Dat laatste is directer bewijs dan alles wat uit bytecode af te
// leiden valt: een contract dat zichzelf DeployableMockCiphertextVerifier noemt
// hoeft niet geinterpreteerd te worden.
async function fetchProvenance(base: string, address: Address): Promise<Provenance | null> {
  try {
    const res = await fetch(`${base}/api/v2/addresses/${address}`)
    if (!res.ok) return null
    const d = (await res.json()) as Record<string, unknown>
    return {
      name: (d.name as string) || null,
      creator: (d.creator_address_hash as string) || null,
      creationTx: ((d.creation_transaction_hash || d.creation_tx_hash) as string) || null,
    }
  } catch {
    return null
  }
}

const ZERO = '0x0000000000000000000000000000000000000000'

// Het BN254-veldmodulus. Elke Groth16-achtige verifier op EVM rekent over deze
// curve en draagt de constante daarom letterlijk in zijn bytecode. Aanwezigheid
// is een veel specifieker signaal dan grootte: een stub die `return true` doet
// heeft geen enkele reden om dit getal bij zich te hebben.
//
// Afwezigheid bewijst niets over een andere curve, en aanwezigheid bewijst niet
// dat de verifier klopt. Beide voorbehouden staan in de UI.
// Basisveld-modulus. Alleen dit getal wijst op pairing-rekenwerk -- de kern
// van een Groth16/Honk-verificatie.
const BN254_P = '30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47'
// Scalarveld-modulus. Zwakker bewijs: een wrapper draagt dit vaak alleen om
// publieke inputs op bereik te controleren, zonder zelf iets te verifieren.
// Mijn eerste versie behandelde P en R als gelijkwaardig en noemde daardoor een
// input-validerende wrapper "een echte verifier". Dat was te sterk.
const BN254_R = '30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001'

// Wrappers zoals BfvDecryptionVerifier doen de bereikcontroles zelf en laten
// het pairing-werk over aan een circuitVerifier. Die volgen is geen heuristiek
// maar de daadwerkelijke structuur.
const CIRCUIT_VERIFIER_ABI = [
  { name: 'circuitVerifier', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

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

export function clientFor(_target: NetworkTarget, rpcOverride?: string): ChainReader {
  return createPublicClient({ chain: ROBINHOOD, transport: http(rpcOverride || ROBINHOOD_RPC, { batch: true }) }) as unknown as ChainReader
}

async function readSlot(client: ChainReader, target: NetworkTarget, spec: (typeof SLOTS)[number]): Promise<SlotResult> {
  const bracken = target.bracken
  const base = { slot: spec.slot, label: spec.label, covers: spec.covers, provenance: null }
  let address: Address | null = null

  try {
    address = (await client.readContract({
      address: bracken,
      abi: Bracken__factory.abi,
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

  const provenance = await fetchProvenance(target.blockscout, address)

  let codeSize: number | null = null
  let rawCode: string | undefined
  try {
    rawCode = await client.getCode({ address })
    codeSize = rawCode && rawCode !== '0x' ? (rawCode.length - 2) / 2 : 0
  } catch {
    codeSize = null
  }

  if (codeSize === 0) {
    return { ...base, provenance, address, codeSize, verdict: 'empty', detail: 'An address is registered, but there is no contract at it.' }
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
  // Volg circuitVerifier() als het contract er een heeft.
  let inner: Address | null = null
  try {
    inner = (await client.readContract({
      address,
      abi: CIRCUIT_VERIFIER_ABI,
      functionName: 'circuitVerifier',
      args: [],
    })) as Address
  } catch {
    inner = null
  }
  let innerSize: number | null = null
  if (inner && inner.toLowerCase() !== ZERO) {
    try {
      const ic = await client.getCode({ address: inner })
      innerSize = ic && ic !== '0x' ? (ic.length - 2) / 2 : 0
      hex += (ic || '').toLowerCase()
      via += ` It delegates the proof check to ${inner} (${innerSize} bytes).`
    } catch {
      via += ` It delegates to ${inner}, whose code could not be read.`
    }
  }

  const doesPairing = hex.includes(BN254_P)
  const onlyRangeChecks = !doesPairing && hex.includes(BN254_R)

  if (doesPairing) {
    return {
      ...base,
      provenance,
      address,
      codeSize,
      verdict: 'present',
      detail: `${codeSize} bytes, and the BN254 base-field modulus is present — pairing arithmetic, which is what verifying a proof actually costs.${via} Whether it checks the right circuit is beyond what can be read from chain.`,
    }
  }
  // De geverifieerde naam is directer bewijs dan de bytecode-test. Heet het
  // ding zelf "Mock", dan is de zaak rond. Heet het iets anders -- Sepolia's
  // slot bevat een Risc0BfvCiphertextVerifier -- dan zegt het ontbreken van
  // BN254 alleen dat er geen pairing plaatsvindt, niet dat er niets gebeurt.
  // RISC Zero verifieert over een ander systeem. Dat als "stub" wegzetten zou
  // precies de fout zijn waar dit gereedschap voor bedoeld is.
  const nm = provenance?.name || ''
  const namedMock = /mock/i.test(nm)
  if (!namedMock && nm) {
    return {
      ...base,
      provenance,
      address,
      codeSize,
      verdict: 'inconclusive',
      detail: `${codeSize} bytes and no BN254 base-field modulus, so no pairing arithmetic happens here. But its verified source is named ${nm}, which is not a mock — it may verify over a different proof system (RISC Zero, for one) that this check cannot see.${via}`,
    }
  }

  return {
    ...base,
    provenance,
    address,
    codeSize,
    verdict: 'stub',
    detail: namedMock
      ? `Its own verified source is named ${nm}. No interpretation needed: this slot holds a mock.${via}`
      : onlyRangeChecks
        ? `${codeSize} bytes. It carries the BN254 scalar modulus but not the base-field one, so it range-checks inputs without ever doing pairing arithmetic.${via} Nothing here verifies a proof.`
        : `${codeSize} bytes, and no BN254 constants at all.${via} A Groth16-style verifier cannot work without them, so this is not verifying one.`,
  }
}

export type AuditResult = {
  target: NetworkTarget
  slots: SlotResult[]
  blockNumber: bigint | null
  error: string | null
}

export async function auditNetwork(target: NetworkTarget, rpcOverride?: string): Promise<AuditResult> {
  // Geen deployment, niets te lezen. Dat is een antwoord, geen fout -- de
  // pagina hoort het te zeggen in plaats van een RPC-fout te tonen.
  if (!target.bracken) return { target, slots: [], blockNumber: null, error: null }
  const client = clientFor(target, rpcOverride)
  try {
    const [blockNumber, slots] = await Promise.all([client.getBlockNumber(), Promise.all(SLOTS.map((s) => readSlot(client, target, s)))])
    return { target, slots, blockNumber, error: null }
  } catch (e) {
    return { target, slots: [], blockNumber: null, error: (e as Error).message.split('\n')[0] }
  }
}
