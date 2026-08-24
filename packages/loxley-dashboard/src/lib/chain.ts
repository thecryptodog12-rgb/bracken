// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
// Sepolia public client + contract addresses.
// Addresses sourced from packages/loxley-contracts/deployed_contracts.json
// and examples/CRISP/packages/crisp-contracts/deployed_contracts.json.
//
// ABIs are imported from the canonical typechain factories in
// @loxley/contracts so they cannot drift from the deployed contracts.

import { createPublicClient, defineChain, http, type Address } from 'viem'

// Robinhood Chain. Het dashboard stond op Sepolia en las daar contracten die
// niet van ons waren -- vier van de vijf adressen hieronder kwamen letterlijk
// uit upstream-interfold-deployments.reference.json. Zolang die als
// standaardwaarde bleven staan, toonde deze pagina andermans E3's, comites en
// operators als de onze. Ze zijn vervangen door het nul-adres: leeg tot er
// werkelijk iets van ons staat.
export const ROBINHOOD = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Explorer', url: 'https://explorer.mainnet.chain.robinhood.com' } },
})

const NOT_DEPLOYED = '0x0000000000000000000000000000000000000000'
import {
  BondingRegistry__factory,
  CiphernodeRegistryOwnable__factory,
  Faucet__factory,
  Loxley__factory,
  LoxleyTicketToken__factory,
  LoxleyToken__factory,
} from '@loxley/contracts/types'

// E3 lifecycle stages — mirrors the Solidity `ILoxley.E3Stage` enum exactly.
// Defined locally (rather than imported from @loxley/sdk) so the dashboard
// has no dependency on the SDK's Rust/Noir build chain when deploying.
export enum E3Stage {
  None = 0,
  Requested = 1,
  CommitteeFinalized = 2,
  KeyPublished = 3,
  CiphertextReady = 4,
  Complete = 5,
  Failed = 6,
}

// All deployment-specific values are env-overridable (see .env.example) so the
// dashboard can point at a different deployment without code changes. Defaults
// are the current Sepolia deployment from deployed_contracts.json.
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>
const envStr = (key: string, fallback: string): string => {
  const v = env[key]
  return v && v.trim() !== '' ? v.trim() : fallback
}

// The faucet is the one address that can be switched off, so it needs to tell an
// unset variable (use the default) from an explicitly empty one (disable). Every
// other setting is resolved with `envStr`, which folds empty into the fallback
// and so can never yield the disabled state.
const FAUCET_DEFAULT = '0x2797A03F78a4237D6ba97170589BBD1Dca382207'
const faucetAddress = (): string => {
  const configured = env['VITE_FAUCET_ADDRESS']
  return configured === undefined ? FAUCET_DEFAULT : configured.trim()
}

const RPC_URL = envStr('VITE_SEPOLIA_RPC', 'https://ethereum-sepolia.publicnode.com')

export const publicClient = createPublicClient({
  chain: ROBINHOOD,
  transport: http(RPC_URL, { batch: true }),
})

export const CONTRACTS = {
  Loxley: envStr('VITE_LOXLEY_ADDRESS', NOT_DEPLOYED) as Address,
  CiphernodeRegistry: envStr('VITE_CIPHERNODE_REGISTRY_ADDRESS', NOT_DEPLOYED) as Address,
  CRISPProgram: envStr('VITE_CRISP_PROGRAM_ADDRESS', NOT_DEPLOYED) as Address,
  // Operator-guide contracts. The bonding registry is the only address the guide
  // needs hardcoded — the ciphernode bond token, ticket wrapper, and ticket underlying
  // are all read back from it at runtime so they cannot drift.
  BondingRegistry: envStr('VITE_BONDING_REGISTRY_ADDRESS', NOT_DEPLOYED) as Address,
  // Testnet-only convenience faucet (LOXLEY + fee token). The zero address or an
  // empty string disables the faucet card in the operator guide.
  Faucet: faucetAddress() as Address,
}

// The chain the dashboard writes to. Reads use `publicClient`; the operator guide
// refuses to send a transaction unless the wallet is on this chain.
export const CHAIN = ROBINHOOD

// First block to scan from — lower bound for getLogs. This bounds queries against
// Loxley, CiphernodeRegistry and CRISPProgram, so it must be the earliest of
// those three deploy blocks (CiphernodeRegistry), not Loxley's: a later value
// would silently drop registry events emitted before Loxley was deployed.
export const DEPLOY_BLOCK = BigInt(envStr('VITE_DEPLOY_BLOCK', '0'))

// E3 timeout windows (seconds), matching the deployment's timeoutConfig. Used to
// decide whether an E3 is still genuinely active vs. expired without completing.
export const TIMEOUTS = {
  computeWindow: Number(envStr('VITE_COMPUTE_WINDOW', '86400')),
  decryptionWindow: Number(envStr('VITE_DECRYPTION_WINDOW', '3600')),
}

export const loxleyAbi = Loxley__factory.abi
export const ciphernodeRegistryAbi = CiphernodeRegistryOwnable__factory.abi
export const bondingRegistryAbi = BondingRegistry__factory.abi
export const ticketTokenAbi = LoxleyTicketToken__factory.abi
export const ciphernodeBondTokenAbi = LoxleyToken__factory.abi
export const faucetAbi = Faucet__factory.abi
