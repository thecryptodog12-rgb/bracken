// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

import type { Log } from 'viem'

export enum LoxleyEventType {
  E3_REQUESTED = 'E3Requested',
  CIPHERTEXT_OUTPUT_PUBLISHED = 'CiphertextOutputPublished',
  PLAINTEXT_OUTPUT_PUBLISHED = 'PlaintextOutputPublished',
  E3_PROGRAM_REGISTERED = 'E3ProgramRegistered',
  ENCRYPTION_SCHEME_ENABLED = 'EncryptionSchemeEnabled',
  CIPHERNODE_REGISTRY_SET = 'CiphernodeRegistrySet',
  MAX_DURATION_SET = 'MaxDurationSet',
  PARAM_SET_REGISTERED = 'ParamSetRegistered',
  OWNERSHIP_TRANSFERRED = 'OwnershipTransferred',
  INITIALIZED = 'Initialized',
}

export enum RegistryEventType {
  COMMITTEE_REQUESTED = 'CommitteeRequested',
  COMMITTEE_PUBLISHED = 'CommitteePublished',
  COMMITTEE_FINALIZED = 'SortitionCommitteeFinalized',
  LOXLEY_SET = 'LoxleySet',
  OWNERSHIP_TRANSFERRED = 'OwnershipTransferred',
  INITIALIZED = 'Initialized',
}

export type AllEventTypes = LoxleyEventType | RegistryEventType

export interface E3RequestedData {
  e3Id: bigint
  e3: {
    seed: bigint
    committeeSize: number
    requestBlock: bigint
    inputWindow: readonly [bigint, bigint]
    encryptionSchemeId: string
    e3Program: string
    paramSet: number
    decryptionVerifier: string
    committeePublicKey: string
    ciphertextOutput: string
    ciphertextCommitment: string
    plaintextOutput: string
  }
  cryptoConfigId: string
}

export interface E3ActivatedData {
  e3Id: bigint
  expiration: bigint
  committeePublicKey: string
}

export interface CiphertextOutputPublishedData {
  e3Id: bigint
  ciphertextOutput: string
  ciphertextCommitment: string
}

export interface PlaintextOutputPublishedData {
  e3Id: bigint
  plaintextOutput: string
  proof: string
}

export interface CiphernodeAddedData {
  node: string
  index: bigint
  numNodes: bigint
  size: bigint
}

export interface CiphernodeRemovedData {
  node: string
  index: bigint
  numNodes: bigint
  size: bigint
}

export interface CommitteeRequestedData {
  e3Id: bigint
  entropyBlock: bigint
  threshold: [bigint, bigint]
  requestBlock: bigint
  committeeDeadline: bigint
  ticketPrice: bigint
}

export interface CommitteePublishedData {
  e3Id: bigint
  nodes: string[]
  publicKey: string
  pkCommitment: string
  proof: string
}

export interface CommitteeFinalizedData {
  e3Id: bigint
  committee: string[]
  scores: bigint[]
}

export interface LoxleyEventData {
  [LoxleyEventType.E3_REQUESTED]: E3RequestedData
  [LoxleyEventType.CIPHERTEXT_OUTPUT_PUBLISHED]: CiphertextOutputPublishedData
  [LoxleyEventType.PLAINTEXT_OUTPUT_PUBLISHED]: PlaintextOutputPublishedData
  [LoxleyEventType.E3_PROGRAM_REGISTERED]: { e3Program: string }
  [LoxleyEventType.ENCRYPTION_SCHEME_ENABLED]: { encryptionSchemeId: string }
  [LoxleyEventType.CIPHERNODE_REGISTRY_SET]: { ciphernodeRegistry: string }
  [LoxleyEventType.MAX_DURATION_SET]: { maxDuration: bigint }
  [LoxleyEventType.PARAM_SET_REGISTERED]: { paramSet: number; encodedParams: string }
  [LoxleyEventType.OWNERSHIP_TRANSFERRED]: { previousOwner: string; newOwner: string }
  [LoxleyEventType.INITIALIZED]: { version: bigint }
}

export interface RegistryEventData {
  [RegistryEventType.COMMITTEE_REQUESTED]: CommitteeRequestedData
  [RegistryEventType.COMMITTEE_PUBLISHED]: CommitteePublishedData
  [RegistryEventType.COMMITTEE_FINALIZED]: CommitteeFinalizedData
  [RegistryEventType.LOXLEY_SET]: { loxley: string }
  [RegistryEventType.OWNERSHIP_TRANSFERRED]: { previousOwner: string; newOwner: string }
  [RegistryEventType.INITIALIZED]: { version: bigint }
}

export interface LoxleyEvent<T extends AllEventTypes> {
  type: T
  data: T extends LoxleyEventType ? LoxleyEventData[T] : T extends RegistryEventType ? RegistryEventData[T] : unknown
  log: Log
  timestamp: Date
  blockNumber: bigint
  transactionHash: string
}

export type EventCallback<T extends AllEventTypes = AllEventTypes> = (event: LoxleyEvent<T>) => void | Promise<void>

export interface EventFilter<T = unknown> {
  address?: `0x${string}`
  fromBlock?: bigint
  toBlock?: bigint
  args?: Partial<T>
}

export interface SDKEventEmitter {
  on<T extends AllEventTypes>(eventType: T, callback: EventCallback<T>): void
  off<T extends AllEventTypes>(eventType: T, callback: EventCallback<T>): void
  emit<T extends AllEventTypes>(event: LoxleyEvent<T>): void
}

export interface EventListenerConfig {
  fromBlock?: bigint
  toBlock?: bigint
  polling?: boolean
  pollingInterval?: number
}
