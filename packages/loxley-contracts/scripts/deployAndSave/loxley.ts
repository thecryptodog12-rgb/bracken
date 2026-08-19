// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";

import { Loxley, Loxley__factory as LoxleyFactory } from "../../types";
import { getProxyAdmin, verifyProxyAdminOwner } from "../proxy";
import { readDeploymentArgs, storeDeploymentArgs } from "../utils";

/**
 * Timeout configuration for E3 stages
 */
export interface E3TimeoutConfig {
  dkgWindow: number;
  computeWindow: number;
  decryptionWindow: number;
}

/**
 * The arguments for the deployAndSaveLoxley function
 */
export interface LoxleyArgs {
  owner?: string;
  maxDuration?: string;
  registry?: string;
  bondingRegistry?: string;
  e3RefundManager?: string;
  feeToken?: string;
  feeTokenDecimals?: number;
  timeoutConfig?: E3TimeoutConfig;
  initialE3Program: string;
  hre: HardhatRuntimeEnvironment;
}

/**
 * Deploys the Loxley contract and saves the deployment arguments
 * @param param0 - The deployment arguments
 * @returns The deployed Loxley contract
 */
export const deployAndSaveLoxley = async ({
  owner,
  maxDuration,
  registry,
  bondingRegistry,
  e3RefundManager,
  feeToken,
  feeTokenDecimals = 6,
  timeoutConfig,
  initialE3Program,
  hre,
}: LoxleyArgs): Promise<{ loxley: Loxley }> => {
  const { ethers } = await hre.network.connect();

  if ((await ethers.provider.getCode(initialE3Program)) === "0x") {
    throw new Error(
      `initialE3Program has no deployed code: ${initialE3Program}`,
    );
  }

  const [signer] = await ethers.getSigners();

  const chain = hre.globalOptions.network;
  const preDeployedArgs = readDeploymentArgs("Loxley", chain);

  if (
    !owner ||
    !maxDuration ||
    !registry ||
    !bondingRegistry ||
    !e3RefundManager ||
    !feeToken ||
    !timeoutConfig ||
    (preDeployedArgs?.constructorArgs?.owner === owner &&
      preDeployedArgs?.constructorArgs?.maxDuration === maxDuration &&
      preDeployedArgs?.constructorArgs?.registry === registry &&
      preDeployedArgs?.constructorArgs?.bondingRegistry === bondingRegistry &&
      preDeployedArgs?.constructorArgs?.e3RefundManager === e3RefundManager &&
      preDeployedArgs?.constructorArgs?.feeToken === feeToken &&
      preDeployedArgs?.constructorArgs?.feeTokenDecimals ===
        feeTokenDecimals.toString() &&
      preDeployedArgs?.constructorArgs?.initialE3Program === initialE3Program)
  ) {
    if (!preDeployedArgs?.address) {
      throw new Error("Loxley address not found, it must be deployed first");
    }
    const loxleyContract = LoxleyFactory.connect(
      preDeployedArgs.address,
      signer,
    );
    return { loxley: loxleyContract };
  }

  const pricingLibFactory = await ethers.getContractFactory(
    "LoxleyPricing",
    signer,
  );
  const pricingLib = await pricingLibFactory.deploy();
  await pricingLib.waitForDeployment();
  const pricingLibAddress = await pricingLib.getAddress();

  const lifecycleLibFactory = await ethers.getContractFactory(
    "LoxleyLifecycle",
    signer,
  );
  const lifecycleLib = await lifecycleLibFactory.deploy();
  await lifecycleLib.waitForDeployment();
  const lifecycleLibAddress = await lifecycleLib.getAddress();

  const loxleyFactory = await ethers.getContractFactory("Loxley", {
    signer,
    libraries: {
      LoxleyLifecycle: lifecycleLibAddress,
      LoxleyPricing: pricingLibAddress,
    },
  });

  const loxley = await loxleyFactory.deploy();
  await loxley.waitForDeployment();
  const blockNumber = await ethers.provider.getBlockNumber();
  const loxleyAddress = await loxley.getAddress();

  storeDeploymentArgs(
    { address: pricingLibAddress, blockNumber },
    "LoxleyPricing",
    chain,
  );
  storeDeploymentArgs(
    { address: lifecycleLibAddress, blockNumber },
    "LoxleyLifecycle",
    chain,
  );

  const initData = loxleyFactory.interface.encodeFunctionData("initialize", [
    owner,
    registry,
    bondingRegistry,
    e3RefundManager,
    {
      token: feeToken,
      expectedDecimals: feeTokenDecimals,
      pricing: {
        keyGenFixedPerNode: 100000,
        keyGenPerEncryptionProof: 50000,
        coordinationPerPair: 10000,
        availabilityPerNodePerSec: 50,
        decryptionPerNode: 300000,
        publicationBase: 1000000,
        verificationPerProof: 5000,
        protocolTreasury: "0x0000000000000000000000000000000000000000",
        marginBps: 1000,
        protocolShareBps: 0,
        dkgUtilizationBps: 2500,
        computeUtilizationBps: 5000,
        decryptUtilizationBps: 2500,
        minCommitteeSize: 0,
        minThreshold: 0,
      },
    },
    maxDuration,
    timeoutConfig,
    initialE3Program,
  ]);

  const ProxyCF = await ethers.getContractFactory(
    "TransparentUpgradeableProxy",
  );
  const proxy = await ProxyCF.deploy(loxleyAddress, owner, initData);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();

  const proxyAdminAddress = await getProxyAdmin(ethers.provider, proxyAddress);

  storeDeploymentArgs(
    {
      constructorArgs: {
        owner,
        registry,
        bondingRegistry,
        e3RefundManager,
        feeToken,
        feeTokenDecimals: feeTokenDecimals.toString(),
        maxDuration,
        timeoutConfig: JSON.stringify(timeoutConfig),
        initialE3Program,
      },
      libraries: {
        LoxleyLifecycle: lifecycleLibAddress,
        LoxleyPricing: pricingLibAddress,
      },
      proxyRecords: {
        initData,
        initialOwner: owner,
        proxyAddress,
        proxyAdminAddress,
        implementationAddress: loxleyAddress,
      },
      blockNumber,
      address: proxyAddress,
    },
    "Loxley",
    chain,
  );

  const loxleyContract = LoxleyFactory.connect(proxyAddress, signer);

  return { loxley: loxleyContract };
};

/**
 * Upgrades the Loxley implementation while keeping the same proxy address
 * @param param0 - The upgrade arguments
 * @returns The upgraded Loxley contract (same proxy address)
 */
export const upgradeAndSaveLoxley = async ({
  ownerAddress,
  hre,
}: {
  ownerAddress: string;
  hre: HardhatRuntimeEnvironment;
}): Promise<{ loxley: Loxley; implementationAddress: string }> => {
  const { ethers } = await hre.network.connect();
  const [signer] = await ethers.getSigners();
  const chain = hre.globalOptions.network;

  const preDeployedArgs = readDeploymentArgs("Loxley", chain);
  if (!preDeployedArgs?.address) {
    throw new Error(
      "Loxley proxy not found. Deploy first before upgrading.",
    );
  }

  const proxyAddress = preDeployedArgs.address;

  const autoProxyAdminAddress = await getProxyAdmin(
    ethers.provider,
    proxyAddress,
  );
  console.log("Auto-deployed ProxyAdmin address:", autoProxyAdminAddress);

  const pricingLibFactory = await ethers.getContractFactory(
    "LoxleyPricing",
    signer,
  );
  const pricingLib = await pricingLibFactory.deploy();
  await pricingLib.waitForDeployment();
  const pricingLibAddress = await pricingLib.getAddress();

  const lifecycleLibFactory = await ethers.getContractFactory(
    "LoxleyLifecycle",
    signer,
  );
  const lifecycleLib = await lifecycleLibFactory.deploy();
  await lifecycleLib.waitForDeployment();
  const lifecycleLibAddress = await lifecycleLib.getAddress();

  const loxleyFactory = await ethers.getContractFactory("Loxley", {
    signer,
    libraries: {
      LoxleyLifecycle: lifecycleLibAddress,
      LoxleyPricing: pricingLibAddress,
    },
  });

  const newImplementation = await loxleyFactory.deploy();
  await newImplementation.waitForDeployment();
  const newImplementationAddress = await newImplementation.getAddress();
  console.log("New Implementation Address:", newImplementationAddress);

  const blockNumber = await ethers.provider.getBlockNumber();
  storeDeploymentArgs(
    { address: pricingLibAddress, blockNumber },
    "LoxleyPricing",
    chain,
  );
  storeDeploymentArgs(
    { address: lifecycleLibAddress, blockNumber },
    "LoxleyLifecycle",
    chain,
  );

  const proxyAdmin = await ethers.getContractAt(
    "ProxyAdmin",
    autoProxyAdminAddress,
    signer,
  );
  await verifyProxyAdminOwner(proxyAdmin, ownerAddress);

  // TODO: Add init data if needed
  const initData = "0x";
  const upgradeTx = await proxyAdmin.upgradeAndCall(
    proxyAddress,
    newImplementationAddress,
    initData,
  );
  await upgradeTx.wait();

  const existingProxyRecords = preDeployedArgs.proxyRecords
    ? Object.fromEntries(
        Object.entries(preDeployedArgs.proxyRecords).filter(
          ([, value]) => value !== undefined,
        ),
      )
    : {};

  const proxyRecords: Record<string, string | string[]> = {
    ...existingProxyRecords,
    implementationAddress: newImplementationAddress,
  };

  if (initData !== "0x") {
    proxyRecords.initData = initData;
  }

  storeDeploymentArgs(
    {
      ...preDeployedArgs,
      libraries: {
        LoxleyLifecycle: lifecycleLibAddress,
        LoxleyPricing: pricingLibAddress,
      },
      proxyRecords,
    },
    "Loxley",
    chain,
  );

  const loxleyContract = LoxleyFactory.connect(proxyAddress, signer);
  return {
    loxley: loxleyContract,
    implementationAddress: newImplementationAddress,
  };
};
