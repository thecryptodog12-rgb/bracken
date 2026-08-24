// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// Deploys an initial E3 program.
//
// The protocol stack refuses to deploy without one, and until now that meant
// hunting for an address by hand. This makes step 3 of the runbook a command.
//
// It deploys MockE3Program: the same contract The Interfold registers as the
// first program on Ethereum mainnet. That is not an endorsement of it. The mock
// applies no application-specific rules — it accepts what it is given and
// returns success — so a network running only this program has a working
// pipeline and no application-level checks at all.
//
// It is the honest starting point, not the destination. `CRISPProgram` in
// examples/CRISP is the real thing; its constructor needs a RISC Zero verifier
// on chain, which does not exist on Robinhood Chain today.

import hre from "hardhat";
import { storeDeploymentArgs } from "./utils";

async function main(): Promise<void> {
  const { ethers } = await hre.network.connect();
  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No signer. Is PRIVATE_KEY set?");

  const net = await ethers.provider.getNetwork();
  const deployer = await signer.getAddress();
  const balance = await ethers.provider.getBalance(deployer);

  // Zelfde slot als in deployLoxley: de publieke test-mnemonic is geen
  // deployer voor een echte keten.
  const LOCAL_IDS = new Set([31337n, 1337n]);
  const WELL_KNOWN = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
  if (!LOCAL_IDS.has(net.chainId) && deployer.toLowerCase() === WELL_KNOWN) {
    throw new Error(
      `Refusing to deploy to chainId ${net.chainId} from the public hardhat ` +
        "test account. Set PRIVATE_KEY to a key you control.",
    );
  }

  console.log("Network  :", net.name, `(chainId ${net.chainId})`);
  console.log("Deployer :", deployer);
  console.log("Balance  :", ethers.formatEther(balance), "native");

  if (balance === 0n) {
    throw new Error("Deployer has no balance on this chain. Fund it first.");
  }

  console.log("\nDeploying MockE3Program…");
  const factory = await ethers.getContractFactory("MockE3Program");
  const program = await factory.deploy();
  await program.waitForDeployment();
  const address = await program.getAddress();

  // Zelfde reden als bij het bond token: zonder dit weet een tweede poging niet
  // dat dit programma er al staat.
  storeDeploymentArgs(
    { address, constructorArgs: [] },
    "MockE3Program",
    hre.globalOptions.network ?? "localhost",
  );

  console.log("\n============================================");
  console.log("MockE3Program:", address);
  console.log("============================================");
  console.log("\n  This program enforces no application rules. Anything that");
  console.log("  reaches it is accepted. Fine for bringing a network up;");
  console.log("  replace it before anyone relies on the result.\n");
  console.log(`  export E3_PROGRAM_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
