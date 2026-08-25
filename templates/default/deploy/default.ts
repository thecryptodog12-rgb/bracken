// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

import { getDeploymentChain, readDeploymentArgs, storeDeploymentArgs, updateE3Config } from '@bracken/contracts/scripts'
import { Bracken__factory as BrackenFactory } from '@bracken/contracts/types'
import { ensureTemplateCwd, BRACKEN_CONFIG_FILE } from '../scripts/template-paths'
import { MyProgram__factory as MyProgramFactory } from '../types/factories/contracts'
import hre from 'hardhat'

// Map contract names to config keys
const contractMapping: Record<string, string> = {
  MyProgram: 'e3_program',
  Bracken: 'bracken',
  CiphernodeRegistryOwnable: 'ciphernode_registry',
  BondingRegistry: 'bonding_registry',
  MockUSDC: 'fee_token',
  Faucet: 'faucet',
}

export const deployTemplate = async () => {
  ensureTemplateCwd()
  const { ethers } = await hre.network.connect()
  const [owner] = await ethers.getSigners()

  const chain = getDeploymentChain(hre)

  const brackenAddress = readDeploymentArgs('Bracken', chain)?.address
  if (!brackenAddress) {
    throw new Error('Bracken address not found, it must be deployed first')
  }
  const bracken = BrackenFactory.connect(brackenAddress, owner)

  const poseidonT3Address = readDeploymentArgs('PoseidonT3', chain)?.address
  if (!poseidonT3Address) {
    throw new Error('PoseidonT3 address not found, it must be deployed first')
  }

  const verifier = await ethers.deployContract('MockRISC0Verifier')
  await verifier.waitForDeployment()

  const imageId = await ethers.deployContract('ImageID')
  await imageId.waitForDeployment()

  storeDeploymentArgs(
    {
      address: await imageId.getAddress(),
      blockNumber: await ethers.provider.getBlockNumber(),
    },
    'ImageID',
    chain,
  )

  const programId = await imageId.PROGRAM_ID()
  const ciphertextVerifier = await ethers.deployContract('Risc0BfvCiphertextVerifier', [await verifier.getAddress(), programId])
  await ciphertextVerifier.waitForDeployment()
  const encryptionSchemeId = ethers.keccak256(ethers.toUtf8Bytes('fhe.rs:BFV'))
  await (await bracken.setCiphertextVerifier(encryptionSchemeId, await ciphertextVerifier.getAddress())).wait()

  const e3ProgramFactory = await ethers.getContractFactory(
    MyProgramFactory.abi,
    MyProgramFactory.linkBytecode({
      'npm/poseidon-solidity@0.0.5/PoseidonT3.sol:PoseidonT3': poseidonT3Address,
    }),
    owner,
  )
  const e3Program = await e3ProgramFactory.deploy(await bracken.getAddress(), await verifier.getAddress(), programId)
  await e3Program.waitForDeployment()

  const programAddress = await e3Program.getAddress()
  const tx = await bracken.registerE3Program(programAddress)
  await tx.wait()

  const allowed = await bracken.e3Programs(programAddress)
  if (!allowed) {
    throw new Error(`MyProgram ${programAddress} was not enabled on Bracken ${brackenAddress}`)
  }

  console.log("E3 Program enabled for Bracken's template")

  console.log(
    `
      Deployed MyProgram at address: ${await e3Program.getAddress()}
      Deployed MockRISC0Verifier at address: ${await verifier.getAddress()}
    `,
  )

  storeDeploymentArgs(
    {
      address: await e3Program.getAddress(),
      blockNumber: await ethers.provider.getBlockNumber(),
    },
    'MyProgram',
    chain,
  )

  updateE3Config(chain, BRACKEN_CONFIG_FILE, contractMapping)
}
