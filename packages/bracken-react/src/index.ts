// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

/**
 * @bracken/react
 *
 * React hooks and utilities for Bracken SDK
 */

export { useBrackenSDK } from './useBrackenSDK'
export type { UseBrackenSDKConfig, UseBrackenSDKReturn } from './useBrackenSDK'

// Re-export commonly used types from the main SDK for convenience
export type {
  AllEventTypes,
  EventCallback,
  BrackenEvent,
  E3RequestedData,
  E3ActivatedData,
  CiphertextOutputPublishedData,
  PlaintextOutputPublishedData,
  CiphernodeAddedData,
  CiphernodeRemovedData,
  CommitteeRequestedData,
  CommitteePublishedData,
} from '@bracken/sdk'

export { BrackenEventType, RegistryEventType } from '@bracken/sdk'
