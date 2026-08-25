// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

import type { HardhatUserConfig } from 'hardhat/config'
import { cleanDeploymentsTask } from '@bracken/contracts/tasks/utils'
import { ciphernodeAdd, ciphernodeAdminAdd, ciphernodeMintTokens, updateSubmissionWindow } from '@bracken/contracts/tasks/ciphernode'
import dotenv from 'dotenv'

import hardhatToolboxMochaEthersPlugin from '@nomicfoundation/hardhat-toolbox-mocha-ethers'

dotenv.config()

const mnemonic = process.env.MNEMONIC ?? 'test test test test test test test test test test test junk'
const privateKey = process.env.PRIVATE_KEY!
const rpcUrl = process.env.RPC_URL ?? 'http://localhost:8545'

const chainIds = {
  'arbitrum-mainnet': 42161,
  avalanche: 43114,
  bsc: 56,
  ganache: 1337,
  hardhat: 31337,
  mainnet: 1,
  'optimism-mainnet': 10,
  'polygon-mainnet': 137,
  'polygon-mumbai': 80001,
  sepolia: 11155111,
  goerli: 5,
}

function getChainConfig(chain: keyof typeof chainIds, apiUrl: string) {
  let accounts: [string] | { count: number; mnemonic: string; path: string }
  if (privateKey) {
    accounts = [privateKey]
  } else {
    accounts = {
      count: 10,
      mnemonic: mnemonic,
      path: "m/44'/60'/0'/0",
    }
  }

  return {
    accounts,
    chainId: chainIds[chain],
    url: rpcUrl,
    type: 'http' as const,
    chainType: 'l1' as const,
    blockExplorers: {
      etherscan: {
        apiUrl,
      },
    },
  }
}

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxMochaEthersPlugin],
  tasks: [cleanDeploymentsTask, ciphernodeAdd, ciphernodeAdminAdd, ciphernodeMintTokens, updateSubmissionWindow],
  networks: {
    default: {
      accounts: {
        mnemonic,
      },
      chainId: chainIds.hardhat,
      type: 'edr-simulated',
      chainType: 'l1',
      mining: {
        auto: true,
        interval: 1000,
      },
    },
    localhost: {
      accounts: {
        mnemonic,
      },
      chainId: chainIds.hardhat,
      type: 'http',
      url: 'http://localhost:8545',
      timeout: 60000,
    },
    ganache: {
      accounts: {
        mnemonic,
      },
      chainId: chainIds.ganache,
      url: 'http://localhost:8545',
      type: 'http',
      timeout: 60000,
    },
    arbitrum: getChainConfig('arbitrum-mainnet', process.env.ARBISCAN_API_KEY || ''),
    avalanche: getChainConfig('avalanche', process.env.SNOWTRACE_API_KEY || ''),
    bsc: getChainConfig('bsc', process.env.BSCSCAN_API_KEY || ''),
    mainnet: getChainConfig('mainnet', process.env.ETHERSCAN_API_KEY || ''),
    optimism: getChainConfig('optimism-mainnet', process.env.OPTIMISM_API_KEY || ''),
    'polygon-mainnet': getChainConfig('polygon-mainnet', process.env.POLYGONSCAN_API_KEY || ''),
    'polygon-mumbai': getChainConfig('polygon-mumbai', process.env.POLYGONSCAN_API_KEY || ''),
    sepolia: getChainConfig('sepolia', process.env.ETHERSCAN_API_KEY || ''),
    goerli: getChainConfig('goerli', process.env.ETHERSCAN_API_KEY || ''),
  },
  paths: {
    artifacts: './artifacts',
    cache: './cache',
    sources: './contracts',
    tests: './tests',
  },
  typechain: {
    outDir: './types',
    tsNocheck: false,
  },
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY || '',
    },
    blockscout: {
      enabled: false,
    },
  },
  solidity: {
    version: '0.8.28',
    npmFilesToBuild: [
      'poseidon-solidity/PoseidonT3.sol',
      '@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol',
      '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol',
      '@bracken/contracts/contracts/Bracken.sol',
      '@bracken/contracts/contracts/lib/BrackenLifecycle.sol',
      '@bracken/contracts/contracts/lib/BrackenPricing.sol',
      '@bracken/contracts/contracts/lib/BondingAssetLib.sol',
      '@bracken/contracts/contracts/lib/BondingEligibilityLib.sol',
      '@bracken/contracts/contracts/lib/BondingSlashingLib.sol',
      '@bracken/contracts/contracts/lib/BondingRegistrationLib.sol',
      '@bracken/contracts/contracts/lib/BondingOwnershipLib.sol',
      '@bracken/contracts/contracts/lib/RegistrySortitionLib.sol',
      '@bracken/contracts/contracts/lib/SlashingEvidenceLib.sol',
      '@bracken/contracts/contracts/registry/CiphernodeRegistryOwnable.sol',
      '@bracken/contracts/contracts/registry/BondingRegistry.sol',
      '@bracken/contracts/contracts/registry/BondedCheckpoints.sol',
      '@bracken/contracts/contracts/registry/BondedVotes.sol',
      '@bracken/contracts/contracts/slashing/SlashingManager.sol',
      '@bracken/contracts/contracts/token/BrackenToken.sol',
      '@bracken/contracts/contracts/token/BrackenTicketToken.sol',
      '@bracken/contracts/contracts/test/MockCiphernodeRegistry.sol',
      '@bracken/contracts/contracts/test/MockCiphertextVerifier.sol',
      '@bracken/contracts/contracts/test/MockComputeProvider.sol',
      '@bracken/contracts/contracts/test/MockDecryptionVerifier.sol',
      '@bracken/contracts/contracts/test/MockDkgFoldAttestationVerifier.sol',
      '@bracken/contracts/contracts/test/MockPkVerifier.sol',
      '@bracken/contracts/contracts/test/MockE3Program.sol',
      '@bracken/contracts/contracts/test/MockE3ProgramHarness.sol',
      '@bracken/contracts/contracts/test/MockSlashingVerifier.sol',
      '@bracken/contracts/contracts/test/MockStableToken.sol',
      '@bracken/contracts/contracts/verifiers/bfv/BfvDecryptionVerifier.sol',
      '@bracken/contracts/contracts/verifiers/bfv/Risc0BfvCiphertextVerifier.sol',
      '@bracken/contracts/contracts/verifiers/bfv/BfvPkVerifier.sol',
      '@bracken/contracts/contracts/verifiers/bfv/honk/DkgAggregatorVerifier.sol',
      '@bracken/contracts/contracts/verifiers/bfv/honk/DecryptionAggregatorVerifier.sol',
    ],
    settings: {
      evmVersion: 'paris',
      optimizer: {
        enabled: true,
        runs: 1,
      },
      debug: {
        revertStrings: 'strip',
      },
      metadata: {
        bytecodeHash: 'none',
      },
    },
  },
}

export default config
