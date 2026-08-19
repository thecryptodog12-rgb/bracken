// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

import { getContractAddresses } from './env-config'
import type { ThresholdBfvParamsPresetName } from '@loxley/sdk'
import { THRESHOLD_BFV_PARAMS_PRESET_NAME } from './env-config'

/**
 * Get the Loxley SDK configuration.
 */
export function getLoxleySDKConfig() {
  const contracts = getContractAddresses()
  return {
    autoConnect: true,
    contracts: {
      loxley: contracts.loxley,
      ciphernodeRegistry: contracts.ciphernodeRegistry,
      feeToken: contracts.feeToken,
    },
    thresholdBfvParamsPresetName: THRESHOLD_BFV_PARAMS_PRESET_NAME as ThresholdBfvParamsPresetName,
  }
}
