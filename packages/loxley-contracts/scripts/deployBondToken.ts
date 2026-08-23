// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// Deploys LoxleyBondToken: the ERC-20 that goes on Pons and is bonded by
// ciphernode operators.
//
// Kept separate from deployLoxley on purpose. The token is the one thing that
// has to exist *before* the protocol stack, because the stack needs its address
// as BOND_TOKEN_ADDRESS — and because a token that will be traded deserves its
// own transaction rather than being a line item in a nineteen-contract script.

import hre from "hardhat";

async function main(): Promise<void> {
  const { ethers } = await hre.network.connect();
  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No signer. Is PRIVATE_KEY set?");

  const name = process.env.BOND_TOKEN_NAME ?? "Loxley";
  const symbol = process.env.BOND_TOKEN_SYMBOL ?? "LOXLEY";
  const supply = BigInt(process.env.BOND_TOKEN_SUPPLY ?? "1200000000");
  const recipient = process.env.BOND_TOKEN_RECIPIENT ?? (await signer.getAddress());

  const network = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(await signer.getAddress());

  console.log("Network      :", network.name, `(chainId ${network.chainId})`);
  console.log("Deployer     :", await signer.getAddress());
  console.log("Balance      :", ethers.formatEther(balance), "native");
  console.log("Token        :", `${name} (${symbol})`);
  console.log("Supply       :", supply.toString(), "whole tokens, 18 decimals");
  console.log("Recipient    :", recipient);

  if (balance === 0n) {
    throw new Error("Deployer has no balance on this chain. Fund it before deploying.");
  }

  const factory = await ethers.getContractFactory("LoxleyBondToken");
  const token = await factory.deploy(name, symbol, supply, recipient);
  console.log("\nSubmitted, waiting for confirmation…");
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("\n============================================");
  console.log("LoxleyBondToken:", address);
  console.log("============================================");
  console.log("\nNext:");
  console.log(`  export BOND_TOKEN_ADDRESS=${address}`);
  console.log("  …then run the protocol deploy (scripts/run.ts).");
  console.log("\nVerify:");
  console.log(
    `  pnpm --filter @loxley/contracts exec hardhat verify --network ${network.name} ${address} "${name}" "${symbol}" ${supply} ${recipient}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
