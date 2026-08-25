// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useWalletClient, usePublicClient } from 'wagmi'
import {
  BrackenSDK,
  type SDKConfig,
  type AllEventTypes,
  type EventCallback,
  type ThresholdBfvParamsPresetName,
  BrackenEventType,
  RegistryEventType,
  SDKError,
} from '@bracken/sdk'

type RequestE3Params = Parameters<typeof BrackenSDK.prototype.requestE3>[0]

export interface UseBrackenSDKConfig {
  contracts?: {
    bracken: `0x${string}`
    ciphernodeRegistry: `0x${string}`
    feeToken: `0x${string}`
  }
  autoConnect?: boolean
  thresholdBfvParamsPresetName?: ThresholdBfvParamsPresetName
}

export interface UseBrackenSDKReturn {
  sdk: BrackenSDK | null
  isInitialized: boolean
  error: string | null
  requestE3: typeof BrackenSDK.prototype.requestE3
  getThresholdBfvParamsSet: typeof BrackenSDK.prototype.getThresholdBfvParamsSet
  onBrackenEvent: <T extends AllEventTypes>(eventType: T, callback: EventCallback<T>) => void
  off: <T extends AllEventTypes>(eventType: T, callback: EventCallback<T>) => void
  BrackenEventType: typeof BrackenEventType
  RegistryEventType: typeof RegistryEventType
}

/**
 * React hook for interacting with Bracken SDK
 *
 * @param config Configuration for the SDK initialization
 * @returns Object containing SDK instance and helper methods
 *
 * @example
 * ```tsx
 * import { useBrackenSDK } from '@bracken/react';
 *
 * function MyComponent() {
 *   const {
 *     sdk,
 *     isInitialized,
 *     error,
 *     requestE3,
 *     onBrackenEvent
 *   } = useBrackenSDK({
 *     autoConnect: true,
 *     contracts: {
 *       bracken: '0x...',
 *       ciphernodeRegistry: '0x...',
 *       feeToken: '0x...',
 *     },
 *     thresholdBfvParamsPresetName: 'INSECURE_THRESHOLD_512',
 *   });
 *
 *   // Use the SDK...
 * }
 * ```
 */
export const useBrackenSDK = (config: UseBrackenSDKConfig): UseBrackenSDKReturn => {
  const [sdk, setSdk] = useState<BrackenSDK | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sdkRef = useRef<BrackenSDK | null>(null)

  const publicClient = usePublicClient()

  const { data: walletClient } = useWalletClient()
  const initializeSDK = useCallback(async () => {
    try {
      setError(null)

      if (!publicClient) {
        throw new Error('Public client not available')
      }

      if (sdkRef.current) {
        sdkRef.current.cleanup()
      }

      const sdkConfig: SDKConfig = {
        publicClient,
        walletClient,
        contracts: config.contracts || {
          bracken: '0x0000000000000000000000000000000000000000',
          ciphernodeRegistry: '0x0000000000000000000000000000000000000000',
          feeToken: '0x0000000000000000000000000000000000000000',
        },
        thresholdBfvParamsPresetName: config.thresholdBfvParamsPresetName,
      }

      const newSdk = new BrackenSDK(sdkConfig)
      setSdk(newSdk)
      sdkRef.current = newSdk
      setIsInitialized(true)
    } catch (err: unknown) {
      const errorMessage = err instanceof SDKError ? `SDK Error (${err.code}): ${err.message}` : `Failed to initialize SDK: ${err}`
      setError(errorMessage)
      console.error('SDK initialization failed:', err)
    }
  }, [publicClient, walletClient, config.contracts, config.thresholdBfvParamsPresetName])

  // The SDK is an external system with its own lifecycle (event subscriptions +
  // cleanup), so it is created in an effect and mirrored into state rather than
  // being derived during render.
  useEffect(() => {
    if (config.autoConnect && publicClient && !isInitialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      initializeSDK()
    }
  }, [config.autoConnect, publicClient, isInitialized, initializeSDK])

  // Re-initialize when wallet client changes (connect/disconnect)
  useEffect(() => {
    if (isInitialized && publicClient && walletClient) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      initializeSDK()
    }
  }, [walletClient, initializeSDK, isInitialized, publicClient])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sdkRef.current) {
        sdkRef.current.cleanup()
      }
    }
  }, [])

  const getThresholdBfvParamsSet = useCallback(async () => {
    if (!sdk) throw new Error('SDK not initialized')
    return sdk.getThresholdBfvParamsSet()
  }, [sdk])

  const requestE3 = useCallback(
    (params: RequestE3Params) => {
      if (!sdk) throw new Error('SDK not initialized')
      return sdk.requestE3(params)
    },
    [sdk],
  )

  const onBrackenEvent = useCallback(
    <T extends AllEventTypes>(eventType: T, callback: EventCallback<T>) => {
      if (!sdk) throw new Error('SDK not initialized')
      return sdk.onBrackenEvent(eventType, callback)
    },
    [sdk],
  )

  const off = useCallback(
    <T extends AllEventTypes>(eventType: T, callback: EventCallback<T>) => {
      if (!sdk) throw new Error('SDK not initialized')
      return sdk.off(eventType, callback)
    },
    [sdk],
  )

  return {
    sdk,
    isInitialized,
    error,
    requestE3,
    getThresholdBfvParamsSet,
    onBrackenEvent,
    off,
    BrackenEventType,
    RegistryEventType,
  }
}
