// SPDX-License-Identifier: LGPL-3.0-only
import { ethers as ethersLib } from "ethers";

import { connect } from "./cli";
import { deploymentPath, readJson } from "./files";
import type { ProtocolDeployment } from "./types";
import { loadConfig, requireContract } from "./values";

function assertEqual(label: string, actual: unknown, expected: unknown): void {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`  ok ${label}`);
}

async function assertStruct(
  label: string,
  actualPromise: Promise<Record<string, unknown>>,
  expected: Record<string, unknown>,
): Promise<void> {
  const actual = await actualPromise;
  for (const [field, value] of Object.entries(expected)) {
    assertEqual(`${label}.${field}`, actual[field], value);
  }
}

export async function actionValidate(): Promise<void> {
  const { ethers } = await connect();
  const config = loadConfig();
  const deployment = readJson<ProtocolDeployment>(deploymentPath(config));
  const network = await ethers.provider.getNetwork();
  if (Number(network.chainId) !== deployment.chainId) {
    throw new Error("Connected to the wrong network for this deployment file");
  }

  const ticket = await ethers.getContractAt(
    "BrackenTicketToken",
    deployment.ticketToken,
  );
  const registry = await ethers.getContractAt(
    "CiphernodeRegistryOwnable",
    deployment.ciphernodeRegistry,
  );
  const bracken = await ethers.getContractAt("Bracken", deployment.bracken);
  const refund = await ethers.getContractAt(
    "E3RefundManager",
    deployment.e3RefundManager,
  );
  const bonding = await ethers.getContractAt(
    "BondingRegistry",
    deployment.bondingRegistryProxy,
  );
  const slashing = await ethers.getContractAt(
    "SlashingManager",
    deployment.slashingManager,
  );
  const checkpoints = await ethers.getContractAt(
    "BondedCheckpoints",
    deployment.bondedCheckpoints,
  );

  const proxyAdmin = (target: string) =>
    new ethersLib.Contract(
      target,
      ["function owner() view returns (address)"],
      ethers.provider,
    );

  for (const [label, address] of [
    ["bondingAssetLib", deployment.bondingAssetLib],
    ["bondingEligibilityLib", deployment.bondingEligibilityLib],
    ["bondingSlashingLib", deployment.bondingSlashingLib],
    ["slashingEvidenceLib", deployment.slashingEvidenceLib],
    ["registrySortitionLib", deployment.registrySortitionLib],
    ["brackenLifecycle", deployment.brackenLifecycle],
    ["brackenPricing", deployment.brackenPricing],
    ["bondedCheckpoints", deployment.bondedCheckpoints],
  ] as const) {
    if ((await ethers.provider.getCode(address)) === "0x") {
      throw new Error(`${label}: no contract at ${address}`);
    }
    console.log(`  ok ${label}`);
  }

  const checks: Array<[string, Promise<unknown>, unknown]> = [
    ["ticket.owner", ticket.owner(), config.protocolOwner],
    ["ticket.registry", ticket.registry(), deployment.bondingRegistryProxy],
    ["ticket.underlying", ticket.underlying(), config.ticketUnderlyingToken],
    ["ticket.decimals", ticket.decimals(), config.bonding.ticketTokenDecimals],
    [
      "ticket.registryLocked",
      ticket.registryLocked(),
      config.ticketToken.lockRegistry,
    ],
    ["registry.owner", registry.owner(), config.protocolOwner],
    ["registry.bracken", registry.bracken(), deployment.bracken],
    [
      "registry.bondingRegistry",
      registry.bondingRegistry(),
      deployment.bondingRegistryProxy,
    ],
    [
      "registry.slashingManager",
      registry.slashingManager(),
      deployment.slashingManager,
    ],
    ["bracken.owner", bracken.owner(), config.protocolOwner],
    ["bracken.feeToken", bracken.feeToken(), config.feeToken],
    [
      "bracken.feeTokenDecimals",
      bracken.feeTokenDecimals(),
      config.feeTokenDecimals,
    ],
    [
      "bracken.bondingRegistry",
      bracken.bondingRegistry(),
      deployment.bondingRegistryProxy,
    ],
    [
      "bracken.ciphernodeRegistry",
      bracken.ciphernodeRegistry(),
      deployment.ciphernodeRegistry,
    ],
    [
      "bracken.e3RefundManager",
      bracken.e3RefundManager(),
      deployment.e3RefundManager,
    ],
    [
      "bracken.slashingManager",
      bracken.slashingManager(),
      deployment.slashingManager,
    ],
    ["refund.owner", refund.owner(), config.protocolOwner],
    ["bonding.owner", bonding.owner(), config.protocolOwner],
    ["bonding.ticketToken", bonding.ticketToken(), deployment.ticketToken],
    ["bonding.ciphernodeBondToken", bonding.ciphernodeBondToken(), config.fold],
    ["bonding.ticketPrice", bonding.ticketPrice(), config.bonding.ticketPrice],
    [
      "bonding.requiredCiphernodeBond",
      bonding.requiredCiphernodeBond(),
      config.bonding.requiredCiphernodeBond,
    ],
    [
      "bonding.minTicketBalance",
      bonding.minTicketBalance(),
      config.bonding.minTicketBalance,
    ],
    ["bonding.exitDelay", bonding.exitDelay(), config.bonding.exitDelay],
    [
      "bonding.slashedFundsTreasury",
      bonding.slashedFundsTreasury(),
      config.slashedFundsTreasury,
    ],
    ["bonding.registry", bonding.registry(), deployment.ciphernodeRegistry],
    [
      "bonding.slashingManager",
      bonding.slashingManager(),
      deployment.slashingManager,
    ],
    [
      "registry.sortitionSubmissionWindow",
      registry.sortitionSubmissionWindow(),
      config.registry.sortitionSubmissionWindow,
    ],
    ["bracken.maxDuration", bracken.maxDuration(), config.bracken.maxDuration],
    [
      "bracken.markFailedGracePeriod",
      bracken.markFailedGracePeriod(),
      config.bracken.markFailedGracePeriod,
    ],
    ["bracken.requestsPaused", bracken.requestsPaused(), true],
    [
      "bondingRegistryProxyAdmin.owner",
      proxyAdmin(deployment.bondingRegistryProxyAdmin).owner(),
      config.protocolOwner,
    ],
    [
      "ciphernodeRegistryProxyAdmin.owner",
      proxyAdmin(deployment.ciphernodeRegistryProxyAdmin).owner(),
      config.protocolOwner,
    ],
    [
      "brackenProxyAdmin.owner",
      proxyAdmin(deployment.brackenProxyAdmin).owner(),
      config.protocolOwner,
    ],
    [
      "e3RefundManagerProxyAdmin.owner",
      proxyAdmin(deployment.e3RefundManagerProxyAdmin).owner(),
      config.protocolOwner,
    ],
    ["slashing.bracken", slashing.bracken(), deployment.bracken],
    [
      "slashing.bondingRegistry",
      slashing.bondingRegistry(),
      deployment.bondingRegistryProxy,
    ],
    [
      "slashing.ciphernodeRegistry",
      slashing.ciphernodeRegistry(),
      deployment.ciphernodeRegistry,
    ],
    [
      "slashing.e3RefundManager",
      slashing.e3RefundManager(),
      deployment.e3RefundManager,
    ],
    // The bonded-voting graph. `bonding.bondedCheckpoints` is the one configured reference; the
    // rest is fixed at construction and is checked so a pair deployed against the wrong registry
    // or the wrong token cannot pass validation.
    [
      "bonding.bondedCheckpoints",
      bonding.bondedCheckpoints(),
      deployment.bondedCheckpoints,
    ],
    [
      "bondedCheckpoints.registry",
      checkpoints.registry(),
      deployment.bondingRegistryProxy,
    ],
  ];

  // Only after `--action activate-voting`. Its constructor already enforces the token and registry
  // binding, so these read-backs confirm the deployment file names the contract that was built.
  if (deployment.bondedVotes) {
    const bondedVotes = await ethers.getContractAt(
      "BondedVotes",
      deployment.bondedVotes,
    );
    checks.push(
      ["bondedVotes.token", bondedVotes.token(), config.fold],
      [
        "bondedVotes.votesSource",
        bondedVotes.votesSource(),
        config.escrowVotesAdapter ?? config.fold,
      ],
      [
        "bondedVotes.checkpoints",
        bondedVotes.checkpoints(),
        deployment.bondedCheckpoints,
      ],
      [
        "bondedVotes.registry",
        bondedVotes.registry(),
        deployment.bondingRegistryProxy,
      ],
    );
  } else {
    console.log("  -- bondedVotes not deployed yet (--action activate-voting)");
  }

  // Verifier read-backs. Each is configured by a Safe transaction, so a dropped or reverted write
  // would otherwise leave the reference at address(0) with the deploy script still exiting zero.
  const bfvSchemeId = ethers.id("fhe.rs:BFV");
  // A read-back alone proves only that the address was stored. Bracken returns whatever was
  // configured, so an EOA or an undeployed address passes while being unusable when a receipt is
  // actually verified.
  for (const [label, address] of [
    ["verifiers.ciphertextVerifier", config.verifiers?.ciphertextVerifier],
    ["verifiers.decryptionVerifier", config.verifiers?.decryptionVerifier],
    ["verifiers.pkVerifier", config.verifiers?.pkVerifier],
  ] as const) {
    if (address) await requireContract(ethers.provider, address, label);
  }

  if (config.verifiers?.ciphertextVerifier) {
    checks.push([
      "bracken.getCiphertextVerifier(fhe.rs:BFV)",
      bracken.getCiphertextVerifier(bfvSchemeId),
      config.verifiers.ciphertextVerifier,
    ]);
  }
  if (config.verifiers?.decryptionVerifier) {
    checks.push([
      "bracken.getDecryptionVerifier(fhe.rs:BFV)",
      bracken.getDecryptionVerifier(bfvSchemeId),
      config.verifiers.decryptionVerifier,
    ]);
  }
  if (config.verifiers?.pkVerifier) {
    checks.push([
      "bracken.getPkVerifier(fhe.rs:BFV)",
      bracken.getPkVerifier(bfvSchemeId),
      config.verifiers.pkVerifier,
    ]);
  }

  for (const [label, actualPromise, expected] of checks) {
    const actual = await actualPromise;
    assertEqual(label, actual, expected);
  }

  await assertStruct("bracken.timeout", bracken.getTimeoutConfig(), {
    dkgWindow: config.bracken.timeoutConfig.dkgWindow,
    computeWindow: config.bracken.timeoutConfig.computeWindow,
    decryptionWindow: config.bracken.timeoutConfig.decryptionWindow,
  });
  await assertStruct("bracken.pricing", bracken.getPricingConfig(), {
    ...config.bracken.pricing,
  });
  await assertStruct("refund.workAllocation", refund.getWorkAllocation(), {
    committeeFormationBps: 1000,
    dkgBps: 4000,
    decryptionBps: 4500,
    protocolBps: 500,
    successSlashedNodeBps: 5000,
  });

  for (const threshold of config.bracken.committeeThresholds) {
    assertEqual(
      `bracken.committeeThresholds(${threshold.size}).quorum`,
      await bracken.committeeThresholds(threshold.size, 0),
      threshold.quorum,
    );
    assertEqual(
      `bracken.committeeThresholds(${threshold.size}).total`,
      await bracken.committeeThresholds(threshold.size, 1),
      threshold.total,
    );
  }

  await requireContract(
    ethers.provider,
    deployment.initialE3Program,
    "initialE3Program",
  );
  if (!(await bracken.e3Programs(deployment.initialE3Program))) {
    throw new Error(
      `E3 Program is not registered: ${deployment.initialE3Program}`,
    );
  }
  console.log(`  ok bracken.e3Programs(${deployment.initialE3Program})`);

  const encryptionSchemeId = ethers.id("fhe.rs:BFV");
  for (const [label, actualPromise, expected] of [
    [
      "bracken.decryptionVerifier",
      bracken.decryptionVerifiers(encryptionSchemeId),
      deployment.decryptionVerifier ?? config.verifiers?.decryptionVerifier,
    ],
    [
      "bracken.pkVerifier",
      bracken.pkVerifiers(encryptionSchemeId),
      deployment.pkVerifier ?? config.verifiers?.pkVerifier,
    ],
    [
      "registry.dkgFoldAttestationVerifier",
      registry.dkgFoldAttestationVerifier(),
      deployment.dkgFoldAttestationVerifier ??
        config.verifiers?.dkgFoldAttestationVerifier,
    ],
    [
      "bracken.ciphertextVerifier",
      bracken.getCiphertextVerifier(encryptionSchemeId),
      deployment.ciphertextVerifier ?? config.ciphertextVerifier,
    ],
  ] as const) {
    if (!expected) continue;
    assertEqual(label, await actualPromise, expected);
  }

  if (config.bindInitialE3Program) {
    const program = new ethersLib.Contract(
      config.e3Programs[0],
      ["function bracken() view returns (address)"],
      ethers.provider,
    );
    const bound = await program.bracken();
    if (bound.toLowerCase() !== deployment.bracken.toLowerCase()) {
      throw new Error(
        `E3 Program binding: expected ${deployment.bracken}, got ${bound}`,
      );
    }
    console.log("  ok E3 Program binding");
  }

  const defaultAdmin = ethersLib.ZeroHash;
  if (!(await slashing.hasRole(defaultAdmin, config.protocolOwner))) {
    throw new Error(
      "Protocol owner does not have SlashingManager DEFAULT_ADMIN_ROLE",
    );
  }
  console.log("Protocol validation complete");
}
