// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
import { deployLoxley, getDeploymentChain, readDeploymentArgs, updateE3Config } from '@loxley/contracts/scripts'
import { deployCRISPContracts } from './crisp'
import { syncCrispEnvFromDeployments } from './syncCrispEnv'
import path from 'path'

import hre from 'hardhat'
import { fileURLToPath } from 'url'

// Map contract names to config keys
const contractMapping: Record<string, string> = {
  CRISPProgram: 'e3_program',
  Loxley: 'loxley',
  CiphernodeRegistryOwnable: 'ciphernode_registry',
  BondingRegistry: 'bonding_registry',
  SlashingManager: 'slashing_manager',
  MockUSDC: 'fee_token',
}

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Deploys the Loxley and CRISP contracts
 */
export const deploy = async () => {
  const chain = getDeploymentChain(hre)

  const shouldDeployLoxley = Boolean(process.env.DEPLOY_LOXLEY)
  const withZkVerification = process.env.ENABLE_ZK_VERIFICATION === 'true'

  if (shouldDeployLoxley) {
    await deployLoxley(true, withZkVerification)
  }
  const { governanceComplete } = await deployCRISPContracts()

  if (!readDeploymentArgs('Loxley', chain)?.address) {
    console.log('CRISP prerequisites deployed. Bind the program during protocol governance wiring.')
    return
  }
  if (!governanceComplete) {
    console.log('CRISP configuration sync is deferred until protocol governance completes the program registration and binding.')
    return
  }

  const loxleyConfigPath = path.join(__dirname, '..', '..', '..', 'loxley.config.yaml')
  updateE3Config(chain, loxleyConfigPath, contractMapping)

  syncCrispEnvFromDeployments(chain)
}

deploy().catch((err) => {
  console.error(err)
  process.exit(1)
})
