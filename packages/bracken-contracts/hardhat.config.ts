// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatIgnitionEthers from "@nomicfoundation/hardhat-ignition-ethers";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatTypechainPlugin from "@nomicfoundation/hardhat-typechain";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import dotenv from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";

import {
  ciphernodeAdd,
  ciphernodeAdminAdd,
  ciphernodeMintTokens,
  ciphernodeRemove,
  updateSubmissionWindow,
} from "./tasks/ciphernode";
import {
  enableE3,
  getActiveAggregator,
  getCommitteePublicKey,
  getPlaintextOutput,
  publishCiphertext,
  publishCommittee,
  publishPlaintext,
  requestCommittee,
} from "./tasks/bracken";
import { publishInput, setMockProgramBracken } from "./tasks/program";
import { cleanDeploymentsTask } from "./tasks/utils";

dotenv.config();

const mnemonic =
  process.env.MNEMONIC ??
  "test test test test test test test test test test test junk";
const privateKey = process.env.PRIVATE_KEY!;
const rpcUrl = process.env.RPC_URL ?? "http://localhost:8545";

const chainIds = {
  "arbitrum-mainnet": 42161,
  avalanche: 43114,
  bsc: 56,
  ganache: 1337,
  hardhat: 31337,
  mainnet: 1,
  "optimism-mainnet": 10,
  "polygon-mainnet": 137,
  "polygon-mumbai": 80001,
  sepolia: 11155111,
  goerli: 5,
  robinhood: 4663,
};

function getChainConfig(chain: keyof typeof chainIds, apiUrl: string) {
  let accounts: [string] | { count: number; mnemonic: string; path: string };
  if (privateKey) {
    accounts = [privateKey];
  } else {
    accounts = {
      count: 10,
      mnemonic: mnemonic,
      path: "m/44'/60'/0'/0",
    };
  }

  return {
    accounts,
    chainId: chainIds[chain],
    url: rpcUrl,
    type: "http" as const,
    chainType: "l1" as const,
    blockExplorers: {
      etherscan: {
        apiUrl,
      },
    },
  };
}

// Robinhood Chain draait Blockscout i.p.v. Etherscan en heeft een eigen RPC, dus
// niet via getChainConfig(). Zelfde vorm -- teruggeven vanuit een functie, zodat
// TypeScript's excess-property-check (die alleen op directe object-literals slaat)
// niet afgaat op blockExplorers.
function getRobinhoodConfig() {
  let accounts: [string] | { count: number; mnemonic: string; path: string };
  if (privateKey) {
    accounts = [privateKey];
  } else {
    accounts = { count: 10, mnemonic, path: "m/44'/60'/0'/0" };
  }

  return {
    accounts,
    chainId: chainIds.robinhood,
    url:
      process.env.ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com",
    type: "http" as const,
    chainType: "l1" as const,
    // Vaste gaslimiet, want de schatting klopt hier niet.
    //
    // DkgAggregatorVerifier kreeg 4.011.385 gas mee en verbruikte precies dat
    // -- de handtekening van out-of-gas, niet van een revert. Dezelfde
    // deployment tegen dezelfde keten schat 8.155.218. De schatting kwam dus
    // op ongeveer de helft uit van wat nodig was, en de transactie was al
    // betaald voordat dat bleek.
    //
    // Het blok-gaslimiet van 4663 is 2^50, dus hier is geen ruimtegebrek; een
    // ruime vaste waarde is veiliger dan een schatting die stil te laag kan
    // uitvallen. Je betaalt alleen wat werkelijk verbruikt wordt.
    gas: 20_000_000,
    blockExplorers: {
      etherscan: {
        apiUrl: "https://robinhoodchain.blockscout.com/api",
      },
    },
  };
}

const config: HardhatUserConfig = {
  plugins: [
    hardhatToolboxMochaEthersPlugin,
    hardhatTypechainPlugin,
    hardhatNetworkHelpers,
    hardhatIgnitionEthers,
    hardhatEthersChaiMatchers,
    hardhatVerify,
  ],
  tasks: [
    ciphernodeAdd,
    ciphernodeAdminAdd,
    ciphernodeMintTokens,
    ciphernodeRemove,
    requestCommittee,
    getCommitteePublicKey,
    getActiveAggregator,
    publishPlaintext,
    publishCiphertext,
    publishCommittee,
    getPlaintextOutput,
    publishInput,
    setMockProgramBracken,
    enableE3,
    cleanDeploymentsTask,
    updateSubmissionWindow,
  ],
  // Keten 4663 staat niet in het register van hardhat-verify, dus verify gaf
  // "The network robinhood with chain id 4663 is not supported" en de contracten
  // bleven ongeverifieerde bytecode op de explorer. Deze beschrijving voegt hem
  // toe. Blockscout vraagt geen sleutel.
  chainDescriptors: {
    4663: {
      name: "Robinhood Chain",
      chainType: "l1" as const,
      blockExplorers: {
        blockscout: {
          url: "https://robinhoodchain.blockscout.com",
          apiUrl: "https://robinhoodchain.blockscout.com/api",
        },
      },
    },
  },

  networks: {
    hardhat: {
      chainId: chainIds.hardhat,
      type: "edr-simulated",
      chainType: "l1",
      // Honk aggregator verify.staticCall uses ~3–4M gas in normal runs. The 1B limit is
      // artificial Hardhat headroom (not a mainnet constraint) so BfvVkBindingIntegration
      // can set block + tx gas via HONK_VERIFY_GAS_LIMIT / networkHelpers.setBlockGasLimit.
      // Under --coverage those on-chain verifies are skipped (instrumented verifiers OOG).
      blockGasLimit: 1_000_000_000,
    },
    localhost: {
      accounts: {
        mnemonic,
      },
      chainId: chainIds.hardhat,
      url: "http://localhost:8545",
      type: "http",
      chainType: "l1",
      timeout: 60000,
    },
    ganache: {
      accounts: {
        mnemonic,
      },
      chainId: chainIds.ganache,
      url: "http://localhost:8545",
      type: "http",
      timeout: 60000,
    },
    arbitrum: getChainConfig(
      "arbitrum-mainnet",
      process.env.ARBISCAN_API_KEY || "",
    ),
    avalanche: getChainConfig("avalanche", process.env.SNOWTRACE_API_KEY || ""),
    bsc: getChainConfig("bsc", process.env.BSCSCAN_API_KEY || ""),
    mainnet: getChainConfig("mainnet", process.env.ETHERSCAN_API_KEY || ""),
    optimism: getChainConfig(
      "optimism-mainnet",
      process.env.OPTIMISM_API_KEY || "",
    ),
    "polygon-mainnet": getChainConfig(
      "polygon-mainnet",
      process.env.POLYGONSCAN_API_KEY || "",
    ),
    "polygon-mumbai": getChainConfig(
      "polygon-mumbai",
      process.env.POLYGONSCAN_API_KEY || "",
    ),
    sepolia: getChainConfig("sepolia", process.env.ETHERSCAN_API_KEY || ""),
    goerli: getChainConfig("goerli", process.env.ETHERSCAN_API_KEY || ""),
    robinhood: getRobinhoodConfig(),
    // Fork van keten 4663. Draait de echte deploy tegen de echte ketenstaat --
    // inclusief het echte USDG-contract, dat de BondingRegistry op decimals
    // controleert -- zonder gas uit te geven. Bedoeld om te ontdekken dat er
    // iets misgaat vóórdat de helft van negentien contracten al gedeployed is
    // en het geld weg is.
    // De drie deploy-stappen zijn drie losse processen tegen één keten. Een
    // in-process fork geeft elk proces zijn eigen verse staat, waardoor stap 4
    // het token uit stap 1 niet ziet. Deze wijst naar een draaiende
    // `hardhat node --fork`, zodat de staat blijft staan zoals op de echte keten.
    robinhoodLocal: {
      type: "http",
      chainType: "l1",
      chainId: chainIds.robinhood,
      url: "http://127.0.0.1:8545",
      timeout: 120000,
      ...(privateKey ? { accounts: [privateKey] } : {}),
    },
    robinhoodFork: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: chainIds.robinhood,
      blockGasLimit: 1_000_000_000,
      forking: {
        url:
          process.env.ROBINHOOD_RPC_URL ??
          "https://rpc.mainnet.chain.robinhood.com",
      },
    },
  },
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY || "",
    },
    // Robinhood Chain draait Blockscout, niet Etherscan. Dit stond uit, dus de
    // verify-taak had geen bruikbaar doel op 4663 en de contracten bleven daar
    // ongeverifieerde bytecode. Voor een protocol waarvan de hele belofte
    // "publiek controleerbaar" is, is dat het verkeerde vakje om uit te laten
    // staan. Blockscout vraagt geen sleutel.
    blockscout: {
      enabled: true,
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  typechain: {
    outDir: "./types",
    tsNocheck: false,
  },
  solidity: {
    npmFilesToBuild: [
      "poseidon-solidity/PoseidonT3.sol",
      "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol",
      "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol",
    ],
    compilers: [
      {
        version: "0.8.28",
        settings: {
          // H-27: Pin EVM target to `paris` so artifacts are portable across
          // chains that do not yet support post-Shanghai/Cancun opcodes (e.g.
          // PUSH0, MCOPY, TLOAD/TSTORE).
          evmVersion: "paris",
          optimizer: {
            enabled: true,
            runs: 1,
          },
          debug: {
            revertStrings: "strip",
          },
          metadata: {
            bytecodeHash: "none",
          },
          // H-22: emit storage layouts so `scripts/validateUpgrade.ts` can
          // snapshot and diff upgradeable contracts across releases.
          outputSelection: {
            "*": {
              "*": [
                "abi",
                "evm.bytecode",
                "evm.deployedBytecode",
                "evm.methodIdentifiers",
                "metadata",
                "storageLayout",
              ],
            },
          },
        },
      },
    ],
  },
};

export default config;
