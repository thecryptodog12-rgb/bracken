// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

/**
 * @loxley/react
 *
 * React hooks and utilities for Loxley SDK
 */

export { useLoxleySDK } from './useLoxleySDK'
export type { UseLoxleySDKConfig, UseLoxleySDKReturn } from './useLoxleySDK'

// Re-export commonly used types from the main SDK for convenience
export type {
  AllEventTypes,
  EventCallback,
  LoxleyEvent,
  E3RequestedData,
  E3ActivatedData,
  CiphertextOutputPublishedData,
  PlaintextOutputPublishedData,
  CiphernodeAddedData,
  CiphernodeRemovedData,
  CommitteeRequestedData,
  CommitteePublishedData,
} from '@loxley/sdk'

export { LoxleyEventType, RegistryEventType } from '@loxley/sdk'
