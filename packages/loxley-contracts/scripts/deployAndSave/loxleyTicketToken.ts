// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";

import {
  LoxleyTicketToken,
  LoxleyTicketToken__factory as LoxleyTicketTokenFactory,
} from "../../types";
import {
  getDeploymentChain,
  readDeploymentArgs,
  storeDeploymentArgs,
} from "../utils";

/**
 * The arguments for the deployAndSaveLoxleyTicketToken function
 */
export interface LoxleyTicketTokenArgs {
  baseToken?: string;
  registry?: string;
  owner?: string;
  hre: HardhatRuntimeEnvironment;
}

/**
 * Deploys the LoxleyTicketToken contract and saves the deployment arguments
 * @param param0 - The deployment arguments
 * @returns The deployed LoxleyTicketToken contract
 */
export const deployAndSaveLoxleyTicketToken = async ({
  baseToken,
  registry,
  owner,
  hre,
}: LoxleyTicketTokenArgs): Promise<{
  loxleyTicketToken: LoxleyTicketToken;
}> => {
  const { ethers } = await hre.network.connect();
  const [signer] = await ethers.getSigners();
  const chain = getDeploymentChain(hre);

  const preDeployedArgs = readDeploymentArgs("LoxleyTicketToken", chain);

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
        "LoxleyTicketToken address not found, it must be deployed first",
      );
    }
    const loxleyTicketTokenContract = LoxleyTicketTokenFactory.connect(
      preDeployedArgs.address,
      signer,
    );
    return { loxleyTicketToken: loxleyTicketTokenContract };
  }

  const loxleyTicketTokenFactory =
    await ethers.getContractFactory("LoxleyTicketToken");
  const loxleyTicketToken = await loxleyTicketTokenFactory.deploy(
    baseToken,
    registry,
    owner,
  );

  await loxleyTicketToken.waitForDeployment();

  const blockNumber = await ethers.provider.getBlockNumber();

  const loxleyTicketTokenAddress = await loxleyTicketToken.getAddress();

  storeDeploymentArgs(
    {
      constructorArgs: {
        baseToken,
        registry,
        owner,
      },
      blockNumber,
      address: loxleyTicketTokenAddress,
    },
    "LoxleyTicketToken",
    chain,
  );

  const loxleyTicketTokenContract = LoxleyTicketTokenFactory.connect(
    loxleyTicketTokenAddress,
    signer,
  );

  return { loxleyTicketToken: loxleyTicketTokenContract };
};
