// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";

import {
  LoxleyToken,
  LoxleyToken__factory as LoxleyTokenFactory,
} from "../../types";
import {
  getDeploymentChain,
  readDeploymentArgs,
  storeDeploymentArgs,
} from "../utils";

/**
 * The arguments for the deployAndSaveLoxleyToken function
 */
export interface LoxleyTokenArgs {
  owner?: string;
  ccaStart?: bigint;
  ccaEnd?: bigint;
  claimSource?: string;
  bondingRegistry?: string;
  noMoreLocks?: bigint;
  hre: HardhatRuntimeEnvironment;
}

/**
 * Disables transfer restrictions for local development
 */
async function disableTransferRestrictionsForLocal(
  contract: LoxleyToken,
  chain: string,
): Promise<void> {
  if (chain !== "localhost" && chain !== "hardhat") {
    return;
  }
  console.log("Disabling transfer restrictions for chain", chain);
  console.log("Contract address", await contract.getAddress());

  const tgeTs = await contract.tgeTimestamp();
  if (tgeTs === 0n) {
    console.warn(
      "TGE not yet fired — call tge() after advancing time past CCA_END + 40 days.",
    );
  } else {
    console.log("Token is already Live (TGE timestamp:", tgeTs.toString(), ")");
  }
}

/**
 * Deploys the LoxleyToken contract and saves the deployment arguments
 * @param param0 - The deployment arguments
 * @returns The deployed LoxleyToken contract
 */
export const deployAndSaveLoxleyToken = async ({
  owner,
  ccaStart,
  ccaEnd,
  claimSource,
  bondingRegistry,
  noMoreLocks,
  hre,
}: LoxleyTokenArgs): Promise<{
  loxleyToken: LoxleyToken;
}> => {
  const { ethers } = await hre.network.connect();
  const [signer] = await ethers.getSigners();
  const chain = getDeploymentChain(hre);

  const preDeployedArgs = readDeploymentArgs("LoxleyToken", chain);

  if (
    !owner ||
    ccaStart === undefined ||
    ccaEnd === undefined ||
    !bondingRegistry ||
    noMoreLocks === undefined ||
    preDeployedArgs?.constructorArgs?.owner === owner
  ) {
    if (!preDeployedArgs?.address) {
      throw new Error(
        "LoxleyToken address not found, it must be deployed first",
      );
    }
    const loxleyTokenContract = LoxleyTokenFactory.connect(
      preDeployedArgs.address,
      signer,
    );

    await disableTransferRestrictionsForLocal(loxleyTokenContract, chain);

    return { loxleyToken: loxleyTokenContract };
  }

  const loxleyTokenFactory = await ethers.getContractFactory("LoxleyToken");
  const loxleyToken = await loxleyTokenFactory.deploy(
    owner,
    ccaStart,
    ccaEnd,
    noMoreLocks,
    bondingRegistry,
  );

  await loxleyToken.waitForDeployment();

  if (claimSource) {
    const signerAddress = await signer.getAddress();
    if (signerAddress.toLowerCase() === owner.toLowerCase()) {
      await (await loxleyToken.setClaimSource(claimSource)).wait();
    } else {
      console.log(
        `Skipping setClaimSource(${claimSource}); owner ${owner} must call it.`,
      );
    }
  }

  const blockNumber = await ethers.provider.getBlockNumber();

  const loxleyTokenAddress = await loxleyToken.getAddress();

  storeDeploymentArgs(
    {
      constructorArgs: {
        owner,
        ccaStart: ccaStart.toString(),
        ccaEnd: ccaEnd.toString(),
        noMoreLocks: noMoreLocks.toString(),
        bondingRegistry,
      },
      blockNumber,
      address: loxleyTokenAddress,
    },
    "LoxleyToken",
    chain,
  );

  const loxleyTokenContract = LoxleyTokenFactory.connect(
    loxleyTokenAddress,
    signer,
  );

  await disableTransferRestrictionsForLocal(loxleyTokenContract, chain);

  return { loxleyToken: loxleyTokenContract };
};
