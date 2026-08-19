// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("Loxley", (m) => {
  const owner = m.getParameter("owner");
  const maxDuration = m.getParameter("maxDuration");
  const registry = m.getParameter("registry");
  const bondingRegistry = m.getParameter("bondingRegistry");
  const e3RefundManager = m.getParameter("e3RefundManager");
  const feeToken = m.getParameter("feeToken");
  const feeTokenDecimals = m.getParameter("feeTokenDecimals", 6);
  const initialE3Program = m.getParameter("initialE3Program");
  const timeoutConfig = m.getParameter("timeoutConfig", {
    dkgWindow: 7200,
    computeWindow: 86400,
    decryptionWindow: 3600,
  });
  const pricingConfig = m.getParameter("pricingConfig", {
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
  });

  // External libraries keep pricing and lifecycle helpers out of the
  // size-constrained Loxley runtime.
  const loxleyLifecycle = m.library("LoxleyLifecycle");
  const loxleyPricing = m.library("LoxleyPricing");
  const loxleyImpl = m.contract("Loxley", [], {
    libraries: {
      LoxleyLifecycle: loxleyLifecycle,
      LoxleyPricing: loxleyPricing,
    },
  });

  const initData = m.encodeFunctionCall(loxleyImpl, "initialize", [
    owner,
    registry,
    bondingRegistry,
    e3RefundManager,
    {
      token: feeToken,
      expectedDecimals: feeTokenDecimals,
      pricing: pricingConfig,
    },
    maxDuration,
    timeoutConfig,
    initialE3Program,
  ]);

  const loxley = m.contract("TransparentUpgradeableProxy", [
    loxleyImpl,
    owner,
    initData,
  ]);

  return { loxley, loxleyLifecycle, loxleyPricing };
}) as any;
