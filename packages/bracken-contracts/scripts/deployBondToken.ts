// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// Deploys BrackenBondToken: the ERC-20 that goes on Pons and is bonded by
// ciphernode operators.
//
// Kept separate from deployBracken on purpose. The token is the one thing that
// has to exist *before* the protocol stack, because the stack needs its address
// as BOND_TOKEN_ADDRESS — and because a token that will be traded deserves its
// own transaction rather than being a line item in a nineteen-contract script.

import hre from "hardhat";
import { storeDeploymentArgs } from "./utils";

async function main(): Promise<void> {
  const { ethers } = await hre.network.connect();
  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No signer. Is PRIVATE_KEY set?");

  const name = process.env.BOND_TOKEN_NAME ?? "Bracken";
  const symbol = process.env.BOND_TOKEN_SYMBOL ?? "BRACKEN";
  const supply = BigInt(process.env.BOND_TOKEN_SUPPLY ?? "1200000000");
  const recipient = process.env.BOND_TOKEN_RECIPIENT ?? (await signer.getAddress());

  const network = await ethers.provider.getNetwork();
  const deployerAddress = await signer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);

  // Zelfde slot als in deployBracken en deployE3Program. Die hadden hem al; dit
  // script niet, en dat was precies de verkeerde plek om hem te missen: dit
  // contract draagt de volledige voorraad en is het enige dat verhandeld wordt.
  // Deployen vanaf de publieke test-sleutel betekent dat iedereen die de
  // tutorial kent bij de voorraad kan.
  const LOCAL_IDS = new Set([31337n, 1337n]);
  const WELL_KNOWN = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
  if (!LOCAL_IDS.has(network.chainId) && deployerAddress.toLowerCase() === WELL_KNOWN) {
    throw new Error(
      `Refusing to deploy to chainId ${network.chainId} from the public hardhat ` +
        `test account (${WELL_KNOWN}). Its private key is in every tutorial on ` +
        "the internet. Set PRIVATE_KEY to a key you control.",
    );
  }

  console.log("Network      :", network.name, `(chainId ${network.chainId})`);
  console.log("Deployer     :", deployerAddress);
  console.log("Balance      :", ethers.formatEther(balance), "native");
  console.log("Token        :", `${name} (${symbol})`);
  console.log("Supply       :", supply.toString(), "whole tokens, 18 decimals");
  console.log("Recipient    :", recipient);

  if (balance === 0n) {
    throw new Error("Deployer has no balance on this chain. Fund it before deploying.");
  }

  const factory = await ethers.getContractFactory("BrackenBondToken");
  const token = await factory.deploy(name, symbol, supply, recipient);
  console.log("\nSubmitted, waiting for confirmation…");
  await token.waitForDeployment();

  const address = await token.getAddress();

  // Vastleggen in deployed_contracts.json, net als de stack met zijn eigen
  // contracten doet.
  //
  // Dit ontbrak, en dat had gevolgen. De stack hergebruikt wat er in dat
  // bestand staat, dus een tweede poging hervat. Het bond token stond er niet
  // in, dus een tweede poging maakte een TWEEDE token met opnieuw de volledige
  // voorraad -- en het eerste bleef achter als een geldig ogend contract met
  // 1,2 miljard erin dat nergens meer bij hoort.
  storeDeploymentArgs(
    {
      address,
      constructorArgs: {
        name_: name,
        symbol_: symbol,
        initialSupply: supply.toString(),
        recipient,
      },
    },
    "BrackenBondToken",
    hre.globalOptions.network ?? "localhost",
  );

  console.log("\n============================================");
  console.log("BrackenBondToken:", address);
  console.log("============================================");
  console.log("\nNext:");
  console.log(`  export BOND_TOKEN_ADDRESS=${address}`);
  console.log("  …then run the protocol deploy (scripts/run.ts).");
  console.log("\nVerify:");
  console.log(
    `  pnpm --filter @bracken/contracts exec hardhat verify --network ${network.name} ${address} "${name}" "${symbol}" ${supply} ${recipient}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
