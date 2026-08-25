// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

import { getContractAddresses } from './env-config'
import type { ThresholdBfvParamsPresetName } from '@bracken/sdk'
import { THRESHOLD_BFV_PARAMS_PRESET_NAME } from './env-config'

/**
 * Get the Bracken SDK configuration.
 */
export function getBrackenSDKConfig() {
  const contracts = getContractAddresses()
  return {
    autoConnect: true,
    contracts: {
      bracken: contracts.bracken,
      ciphernodeRegistry: contracts.ciphernodeRegistry,
      feeToken: contracts.feeToken,
    },
    thresholdBfvParamsPresetName: THRESHOLD_BFV_PARAMS_PRESET_NAME as ThresholdBfvParamsPresetName,
  }
}
