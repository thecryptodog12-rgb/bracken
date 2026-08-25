// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";

import {
  BrackenTicketToken,
  BrackenTicketToken__factory as BrackenTicketTokenFactory,
} from "../../types";
import {
  getDeploymentChain,
  readDeploymentArgs,
  storeDeploymentArgs,
} from "../utils";

/**
 * The arguments for the deployAndSaveBrackenTicketToken function
 */
export interface BrackenTicketTokenArgs {
  baseToken?: string;
  registry?: string;
  owner?: string;
  hre: HardhatRuntimeEnvironment;
}

/**
 * Deploys the BrackenTicketToken contract and saves the deployment arguments
 * @param param0 - The deployment arguments
 * @returns The deployed BrackenTicketToken contract
 */
export const deployAndSaveBrackenTicketToken = async ({
  baseToken,
  registry,
  owner,
  hre,
}: BrackenTicketTokenArgs): Promise<{
  brackenTicketToken: BrackenTicketToken;
}> => {
  const { ethers } = await hre.network.connect();
  const [signer] = await ethers.getSigners();
  const chain = getDeploymentChain(hre);

  const preDeployedArgs = readDeploymentArgs("BrackenTicketToken", chain);

  if (
    !baseToken ||
    !registry ||
    !owner ||
    (preDeployedArgs?.constructorArgs?.baseToken === baseToken &&
      preDeployedArgs?.constructorArgs?.registry === registry &&
      preDeployedArgs?.constructorArgs?.owner === owner)
  ) {
    if (!preDeployedArgs?.address) {
      throw new Error(
        "BrackenTicketToken address not found, it must be deployed first",
      );
    }
    const brackenTicketTokenContract = BrackenTicketTokenFactory.connect(
      preDeployedArgs.address,
      signer,
    );
    return { brackenTicketToken: brackenTicketTokenContract };
  }

  const brackenTicketTokenFactory =
    await ethers.getContractFactory("BrackenTicketToken");
  const brackenTicketToken = await brackenTicketTokenFactory.deploy(
    baseToken,
    registry,
    owner,
  );

  await brackenTicketToken.waitForDeployment();

  const blockNumber = await ethers.provider.getBlockNumber();

  const brackenTicketTokenAddress = await brackenTicketToken.getAddress();

  storeDeploymentArgs(
    {
      constructorArgs: {
        baseToken,
        registry,
        owner,
      },
      blockNumber,
      address: brackenTicketTokenAddress,
    },
    "BrackenTicketToken",
    chain,
  );

  const brackenTicketTokenContract = BrackenTicketTokenFactory.connect(
    brackenTicketTokenAddress,
    signer,
  );

  return { brackenTicketToken: brackenTicketTokenContract };
};
