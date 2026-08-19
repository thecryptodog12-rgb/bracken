// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useWalletClient, usePublicClient } from 'wagmi'
import {
  LoxleySDK,
  type SDKConfig,
  type AllEventTypes,
  type EventCallback,
  type ThresholdBfvParamsPresetName,
  LoxleyEventType,
  RegistryEventType,
  SDKError,
} from '@loxley/sdk'

type RequestE3Params = Parameters<typeof LoxleySDK.prototype.requestE3>[0]

export interface UseLoxleySDKConfig {
  contracts?: {
    loxley: `0x${string}`
    ciphernodeRegistry: `0x${string}`
    feeToken: `0x${string}`
  }
  autoConnect?: boolean
  thresholdBfvParamsPresetName?: ThresholdBfvParamsPresetName
}

export interface UseLoxleySDKReturn {
  sdk: LoxleySDK | null
  isInitialized: boolean
  error: string | null
  requestE3: typeof LoxleySDK.prototype.requestE3
  getThresholdBfvParamsSet: typeof LoxleySDK.prototype.getThresholdBfvParamsSet
  onLoxleyEvent: <T extends AllEventTypes>(eventType: T, callback: EventCallback<T>) => void
  off: <T extends AllEventTypes>(eventType: T, callback: EventCallback<T>) => void
  LoxleyEventType: typeof LoxleyEventType
  RegistryEventType: typeof RegistryEventType
}

/**
 * React hook for interacting with Loxley SDK
 *
 * @param config Configuration for the SDK initialization
 * @returns Object containing SDK instance and helper methods
 *
 * @example
 * ```tsx
 * import { useLoxleySDK } from '@loxley/react';
 *
 * function MyComponent() {
 *   const {
 *     sdk,
 *     isInitialized,
 *     error,
 *     requestE3,
 *     onLoxleyEvent
 *   } = useLoxleySDK({
 *     autoConnect: true,
 *     contracts: {
 *       loxley: '0x...',
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
export const useLoxleySDK = (config: UseLoxleySDKConfig): UseLoxleySDKReturn => {
  const [sdk, setSdk] = useState<LoxleySDK | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sdkRef = useRef<LoxleySDK | null>(null)

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
          loxley: '0x0000000000000000000000000000000000000000',
          ciphernodeRegistry: '0x0000000000000000000000000000000000000000',
          feeToken: '0x0000000000000000000000000000000000000000',
        },
        thresholdBfvParamsPresetName: config.thresholdBfvParamsPresetName,
      }

      const newSdk = new LoxleySDK(sdkConfig)
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

  const onLoxleyEvent = useCallback(
    <T extends AllEventTypes>(eventType: T, callback: EventCallback<T>) => {
      if (!sdk) throw new Error('SDK not initialized')
      return sdk.onLoxleyEvent(eventType, callback)
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
    onLoxleyEvent,
    off,
    LoxleyEventType,
    RegistryEventType,
  }
}
