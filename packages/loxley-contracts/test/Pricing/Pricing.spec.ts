// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
import { expect } from "chai";

import {
  ACTIVE_CRYPTO_CONFIG_ID,
  DATA as data,
  deployLoxleySystem,
  ethers,
  networkHelpers,
  PROOF as proof,
  setPricingConfig,
  setupAndPublishCommittee,
} from "../fixtures";

const { loadFixture, time, mine } = networkHelpers;

describe("E3 Pricing", function () {
  let firstE3Id: bigint;
  // Default pricing config matching initialize() defaults
  const defaultPricingConfig = {
    keyGenFixedPerNode: 100000n,
    keyGenPerEncryptionProof: 50000n,
    coordinationPerPair: 10000n,
    availabilityPerNodePerSec: 50n,
    decryptionPerNode: 300000n,
    publicationBase: 1000000n,
    verificationPerProof: 5000n,
    protocolTreasury: ethers.ZeroAddress,
    marginBps: 1000,
    protocolShareBps: 0,
    dkgUtilizationBps: 2500,
    computeUtilizationBps: 5000,
    decryptUtilizationBps: 2500,
    minCommitteeSize: 0,
    minThreshold: 0,
  };

  // Convert ethers Result to a plain object that can be spread
  const toPlainConfig = (pc: any) => ({
    keyGenFixedPerNode: pc.keyGenFixedPerNode,
    keyGenPerEncryptionProof: pc.keyGenPerEncryptionProof,
    coordinationPerPair: pc.coordinationPerPair,
    availabilityPerNodePerSec: pc.availabilityPerNodePerSec,
    decryptionPerNode: pc.decryptionPerNode,
    publicationBase: pc.publicationBase,
    verificationPerProof: pc.verificationPerProof,
    protocolTreasury: pc.protocolTreasury,
    marginBps: pc.marginBps,
    protocolShareBps: pc.protocolShareBps,
    dkgUtilizationBps: pc.dkgUtilizationBps,
    computeUtilizationBps: pc.computeUtilizationBps,
    decryptUtilizationBps: pc.decryptUtilizationBps,
    minCommitteeSize: pc.minCommitteeSize,
    minThreshold: pc.minThreshold,
  });

  const inputWindowDuration = 300;
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  const setup = async () => {
    // Pricing.spec.ts historically used signers[5] as the treasury.
    const signers = await ethers.getSigners();
    const treasurySigner = signers[5];
    const sys = await deployLoxleySystem({
      treasury: treasurySigner,
      wireSlashingManager: true,
    });
    firstE3Id = await sys.loxley.nexte3Id();
    await mine(1);
    return {
      owner: sys.owner,
      notTheOwner: sys.notTheOwner,
      operator1: sys.operator1!,
      operator2: sys.operator2!,
      operator3: sys.operator3!,
      treasury: treasurySigner,
      loxley: sys.loxley,
      ciphernodeRegistryContract: sys.ciphernodeRegistry,
      bondingRegistry: sys.bondingRegistry,
      ciphernodeBondToken: sys.ciphernodeBondToken,
      ticketToken: sys.ticketToken,
      usdcToken: sys.usdcToken,
      slashingManager: sys.slashingManager,
      e3RefundManager: sys.e3RefundManager,
      request: sys.request,
      mocks: sys.mocks,
    };
  };

  // ──────────────────────────────────────────────────────────────────────────
  //  getE3Quote() — Parametric Fee Calculation
  // ──────────────────────────────────────────────────────────────────────────

  describe("getE3Quote()", function () {
    it("returns a fee based on BaseCosts, committee size, and duration", async function () {
      const { loxley, request } = await loadFixture(setup);

      const fee = await loxley.getE3Quote(request);
      // Fee must be > 0 with default baseCosts
      expect(fee).to.be.gt(0);
    });

    it("computes fee correctly using the parametric formula", async function () {
      const { loxley, request, ciphernodeRegistryContract } =
        await loadFixture(setup);

      // Minimum requires H=2 decryption shares from an N=3 committee.
      const n = 3n; // total committee
      const h = 2n; // required decryption shares

      // Get pricing config
      const pc = await loxley.getPricingConfig();

      // Get timeout config
      const config = await loxley.getTimeoutConfig();
      const sortitionWindow =
        await ciphernodeRegistryContract.sortitionSubmissionWindow();
      const duration =
        sortitionWindow +
        (BigInt(request.inputWindow[1]) - BigInt(request.inputWindow[0])) +
        // M-06: sum BPS-weighted windows first then divide once. With the
        // default config (windows=3600, bps=2500/5000/2500) the per-term and
        // sum-then-divide formulas coincide, but this matches the on-chain
        // implementation and the dedicated DurationPrecision tests.
        (config.dkgWindow * BigInt(pc.dkgUtilizationBps) +
          config.computeWindow * BigInt(pc.computeUtilizationBps) +
          config.decryptionWindow * BigInt(pc.decryptUtilizationBps)) /
          10000n;

      // Calculate expected fee (proof-aware): proofsPerNode = 14 + 4 × (N-1)
      const proofsPerNode = 14n + 4n * (n - 1n);
      let baseFee = pc.keyGenFixedPerNode * n;
      baseFee += pc.keyGenPerEncryptionProof * n * proofsPerNode;
      if (n > 1n) baseFee += (pc.coordinationPerPair * n * (n - 1n)) / 2n;
      baseFee += pc.verificationPerProof * n * proofsPerNode;
      baseFee += pc.availabilityPerNodePerSec * n * duration;
      baseFee += pc.decryptionPerNode * h;
      if (h > 1n) baseFee += (pc.coordinationPerPair * h * (h - 1n)) / 2n;
      baseFee += pc.publicationBase;

      const marginBps = pc.marginBps;
      const expectedFee = (baseFee * (10000n + BigInt(marginBps))) / 10000n;

      const actualFee = await loxley.getE3Quote(request);
      expect(actualFee).to.equal(expectedFee);
    });

    it("charges each required decryption share", async function () {
      const { loxley, request } = await loadFixture(setup);
      const decryptionPerNode = 300000n;

      await setPricingConfig(loxley, {
        ...defaultPricingConfig,
        decryptionPerNode: 0n,
        marginBps: 0,
      });
      const feeWithoutDecryption = await loxley.getE3Quote(request);

      await setPricingConfig(loxley, {
        ...defaultPricingConfig,
        decryptionPerNode,
        marginBps: 0,
      });
      const feeWithDecryption = await loxley.getE3Quote(request);

      expect(feeWithDecryption - feeWithoutDecryption).to.equal(
        decryptionPerNode * 2n,
      );
    });

    it("fee increases with longer input window", async function () {
      const { loxley, request } = await loadFixture(setup);

      const shortFee = await loxley.getE3Quote(request);

      const now = await time.latest();
      const longRequest = {
        ...request,
        inputWindow: [now + 10, now + 3600] as [number, number], // 1 hour vs 5min
      };
      const longFee = await loxley.getE3Quote(longRequest);

      expect(longFee).to.be.gt(shortFee);
    });

    it("charges for an equal-length input window scheduled later", async function () {
      const { loxley, request } = await loadFixture(setup);
      const now = await time.latest();
      const windowLength = 300;

      const nearFee = await loxley.getE3Quote({
        ...request,
        inputWindow: [now + 10, now + 10 + windowLength] as [number, number],
      });
      const delayedFee = await loxley.getE3Quote({
        ...request,
        inputWindow: [now + 7200, now + 7200 + windowLength] as [
          number,
          number,
        ],
      });

      expect(delayedFee).to.be.gt(nearFee);
    });

    it("fee reflects margin changes", async function () {
      const { loxley, request } = await loadFixture(setup);

      const fee10Pct = await loxley.getE3Quote(request);

      // Set margin to 20%
      const pc = toPlainConfig(await loxley.getPricingConfig());
      await setPricingConfig(loxley, { ...pc, marginBps: 2000 });
      const fee20Pct = await loxley.getE3Quote(request);

      expect(fee20Pct).to.be.gt(fee10Pct);

      // Set margin to 0%
      const pc2 = toPlainConfig(await loxley.getPricingConfig());
      await setPricingConfig(loxley, { ...pc2, marginBps: 0 });
      const feeZero = await loxley.getE3Quote(request);

      expect(feeZero).to.be.lt(fee10Pct);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //  Fee asset configuration — Governance
  // ──────────────────────────────────────────────────────────────────────────

  describe("setFeeAssetConfig()", function () {
    it("reverts if not called by owner", async function () {
      const { loxley, notTheOwner } = await loadFixture(setup);
      await expect(
        setPricingConfig(loxley.connect(notTheOwner), defaultPricingConfig),
      ).to.be.revertedWithCustomError(loxley, "OwnableUnauthorizedAccount");
    });

    it("updates config and emits event", async function () {
      const { loxley } = await loadFixture(setup);
      const newConfig = {
        ...defaultPricingConfig,
        keyGenFixedPerNode: 100000n,
        keyGenPerEncryptionProof: 50000n,
        coordinationPerPair: 10000n,
        availabilityPerNodePerSec: 40n,
        decryptionPerNode: 300000n,
        publicationBase: 1000000n,
      };

      await expect(setPricingConfig(loxley, newConfig)).to.emit(
        loxley,
        "FeeAssetConfigUpdated",
      );

      const stored = await loxley.getPricingConfig();
      expect(stored.keyGenFixedPerNode).to.equal(100000n);
      expect(stored.keyGenPerEncryptionProof).to.equal(50000n);
      expect(stored.coordinationPerPair).to.equal(10000n);
      expect(stored.availabilityPerNodePerSec).to.equal(40n);
      expect(stored.decryptionPerNode).to.equal(300000n);
      expect(stored.publicationBase).to.equal(1000000n);
    });

    it("updates the token scale and raw-unit prices together", async function () {
      const { loxley } = await loadFixture(setup);
      const token = await (
        await ethers.getContractFactory("MockLockAwareCiphernodeBondToken")
      ).deploy(0);
      const tokenAddress = await token.getAddress();
      const pricing = {
        ...defaultPricingConfig,
        publicationBase: ethers.parseEther("1"),
      };

      await expect(
        loxley.setFeeAssetConfig({
          token: tokenAddress,
          expectedDecimals: 6,
          pricing,
        }),
      )
        .to.be.revertedWithCustomError(loxley, "FeeTokenDecimalsMismatch")
        .withArgs(tokenAddress, 6, 18);

      await loxley.setFeeAssetConfig({
        token: tokenAddress,
        expectedDecimals: 18,
        pricing,
      });
      expect(await loxley.feeToken()).to.equal(tokenAddress);
      expect(await loxley.feeTokenDecimals()).to.equal(18);
      expect((await loxley.getPricingConfig()).publicationBase).to.equal(
        ethers.parseEther("1"),
      );
    });

    it("changes the fee returned by getE3Quote", async function () {
      const { loxley, request } = await loadFixture(setup);

      const feeBefore = await loxley.getE3Quote(request);

      // Double base costs
      await setPricingConfig(loxley, {
        ...defaultPricingConfig,
        keyGenFixedPerNode: 200000n,
        keyGenPerEncryptionProof: 100000n,
        coordinationPerPair: 20000n,
        availabilityPerNodePerSec: 100n,
        decryptionPerNode: 600000n,
        publicationBase: 2000000n,
      });

      const feeAfter = await loxley.getE3Quote(request);
      expect(feeAfter).to.be.gt(feeBefore);
    });

    it("enforces the public margin cap", async function () {
      const { loxley } = await loadFixture(setup);
      const cap = await loxley.MAX_MARGIN_BPS();
      await expect(
        setPricingConfig(loxley, {
          ...defaultPricingConfig,
          marginBps: cap,
        }),
      ).to.not.be.revert(ethers);
      await expect(
        setPricingConfig(loxley, {
          ...defaultPricingConfig,
          marginBps: cap + 1n,
        }),
      ).to.be.revertedWithCustomError(loxley, "BpsExceedsMax");
    });

    it("allows setting margin to 0", async function () {
      const { loxley } = await loadFixture(setup);
      await setPricingConfig(loxley, {
        ...defaultPricingConfig,
        marginBps: 0,
      });
      const pc = await loxley.getPricingConfig();
      expect(pc.marginBps).to.equal(0);
    });

    it("enforces the public protocol-share cap", async function () {
      const { loxley, treasury } = await loadFixture(setup);
      const cap = await loxley.MAX_PROTOCOL_SHARE_BPS();
      const protocolTreasury = await treasury.getAddress();
      await expect(
        setPricingConfig(loxley, {
          ...defaultPricingConfig,
          protocolTreasury,
          protocolShareBps: cap,
        }),
      ).to.not.be.revert(ethers);
      await expect(
        setPricingConfig(loxley, {
          ...defaultPricingConfig,
          protocolTreasury,
          protocolShareBps: cap + 1n,
        }),
      ).to.be.revertedWithCustomError(loxley, "BpsExceedsMax");
    });

    it("reverts if minCommitteeSize < minThreshold", async function () {
      const { loxley } = await loadFixture(setup);
      await expect(
        setPricingConfig(loxley, {
          ...defaultPricingConfig,
          minCommitteeSize: 2,
          minThreshold: 5,
        }),
      ).to.be.revertedWithCustomError(loxley, "MinSizeBelowMinThreshold");
    });

    it("accepts only circuit-backed committee configurations", async function () {
      const { loxley } = await loadFixture(setup);

      expect(await loxley.MAX_COMMITTEE_SIZE()).to.equal(3);
      await (await loxley.setCommitteeThresholds(0, [2, 3])).wait();
      await expect(
        loxley.setCommitteeThresholds(0, [1, 3]),
      ).to.be.revertedWithCustomError(loxley, "UnsupportedCryptoConfig");
      await expect(
        loxley.setCommitteeThresholds(1, [5, 9]),
      ).to.be.revertedWithCustomError(loxley, "UnsupportedCryptoConfig");
      await expect(
        loxley.setCommitteeThresholds(2, [10, 19]),
      ).to.be.revertedWithCustomError(loxley, "UnsupportedCryptoConfig");
    });

    it("applies pricing minimums to canonical committee configurations", async function () {
      const { loxley } = await loadFixture(setup);

      await setPricingConfig(loxley, {
        ...defaultPricingConfig,
        minCommitteeSize: 5,
        minThreshold: 3,
      });
      await expect(
        loxley.setCommitteeThresholds(0, [2, 3]),
      ).to.be.revertedWithCustomError(loxley, "BelowMinCommitteeSize");

      await setPricingConfig(loxley, {
        ...defaultPricingConfig,
        minCommitteeSize: 3,
        minThreshold: 3,
      });
      await expect(
        loxley.setCommitteeThresholds(0, [2, 3]),
      ).to.be.revertedWithCustomError(loxley, "BelowMinThreshold");

      await setPricingConfig(loxley, {
        ...defaultPricingConfig,
        minCommitteeSize: 3,
        minThreshold: 2,
      });
      await (await loxley.setCommitteeThresholds(0, [2, 3])).wait();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //  Protocol Treasury Share on Reward Distribution
  // ──────────────────────────────────────────────────────────────────────────

  describe("Protocol treasury share on success", function () {
    it("sends 100% to CNs when protocolShareBps is 0 (default)", async function () {
      const {
        loxley,
        usdcToken,
        ciphernodeRegistryContract,
        bondingRegistry,
        owner,
        notTheOwner,
        operator1,
        operator2,
        operator3,
        mocks: { decryptionVerifier, e3Program },
      } = await loadFixture(setup);

      // Build a fresh request with current timestamps
      const now = await time.latest();
      const freshRequest = {
        committeeSize: 0,
        inputWindow: [now + 100, now + inputWindowDuration + 100] as [
          number,
          number,
        ],
        e3Program: await e3Program.getAddress(),
        paramSet: 0,
        computeProviderParams: abiCoder.encode(
          ["address"],
          [await decryptionVerifier.getAddress()],
        ),
        customParams: abiCoder.encode(
          ["address"],
          ["0x1234567890123456789012345678901234567890"],
        ),
        expectedFeeToken: await usdcToken.getAddress(),
        expectedCryptoConfigId: ACTIVE_CRYPTO_CONFIG_ID,
        maxFee: ethers.MaxUint256,
      };

      // Make request with large approval to avoid fee mismatch
      await usdcToken.approve(await loxley.getAddress(), ethers.MaxUint256);
      await loxley.request(freshRequest);
      const e3Id = firstE3Id;
      const fee = await loxley.e3Payments(e3Id);

      // Setup committee
      await setupAndPublishCommittee(
        ciphernodeRegistryContract,
        e3Id,
        "0x1234",
        [operator1, operator2, operator3],
      );

      const operator1Address = await operator1.getAddress();
      const newOwnerAddress = await notTheOwner.getAddress();
      await bondingRegistry
        .connect(owner)
        .proposeBondOwner(operator1Address, newOwnerAddress);
      await bondingRegistry
        .connect(notTheOwner)
        .acceptBondOwner(operator1Address);

      // Publish ciphertext
      await time.increase(inputWindowDuration + 200);
      await loxley.publishCiphertextOutput(
        e3Id,
        data,
        ethers.keccak256(data),
        proof,
      );

      const bondOwner = await owner.getAddress();
      const ownerBefore = await usdcToken.balanceOf(bondOwner);

      // Publish plaintext (triggers _distributeRewards)
      await loxley.publishPlaintextOutput(e3Id, data, proof);

      // The shared bond owner receives all three operator credits.
      expect(await loxley.pendingReward(e3Id, bondOwner)).to.equal(fee);
      expect(await loxley.pendingReward(e3Id, newOwnerAddress)).to.equal(0);
      await loxley.connect(owner).claimReward(e3Id);
      const ownerAfter = await usdcToken.balanceOf(bondOwner);

      expect(ownerAfter - ownerBefore).to.equal(fee);
    });

    it("splits fee between CNs and treasury when protocolShareBps > 0", async function () {
      const {
        loxley,
        usdcToken,
        ciphernodeRegistryContract,
        owner,
        treasury,
        operator1,
        operator2,
        operator3,
        mocks: { decryptionVerifier, e3Program },
      } = await loadFixture(setup);

      // Launch split: 1.82% gross share approximates 20% of the 10% margin.
      const treasuryAddr = await treasury.getAddress();
      await setPricingConfig(loxley, {
        ...defaultPricingConfig,
        protocolTreasury: treasuryAddr,
        protocolShareBps: 182,
      });

      // Build a fresh request with current timestamps
      const now = await time.latest();
      const freshRequest = {
        committeeSize: 0,
        inputWindow: [now + 100, now + inputWindowDuration + 100] as [
          number,
          number,
        ],
        e3Program: await e3Program.getAddress(),
        paramSet: 0,
        computeProviderParams: abiCoder.encode(
          ["address"],
          [await decryptionVerifier.getAddress()],
        ),
        customParams: abiCoder.encode(
          ["address"],
          ["0x1234567890123456789012345678901234567890"],
        ),
        expectedFeeToken: await usdcToken.getAddress(),
        expectedCryptoConfigId: ACTIVE_CRYPTO_CONFIG_ID,
        maxFee: ethers.MaxUint256,
      };

      // Make request with large approval
      await usdcToken.approve(await loxley.getAddress(), ethers.MaxUint256);
      await loxley.request(freshRequest);
      const e3Id = firstE3Id;
      const fee = await loxley.e3Payments(e3Id);

      // Setup committee
      await setupAndPublishCommittee(
        ciphernodeRegistryContract,
        e3Id,
        "0x1234",
        [operator1, operator2, operator3],
      );

      // Publish outputs
      await time.increase(inputWindowDuration + 200);
      await loxley.publishCiphertextOutput(
        e3Id,
        data,
        ethers.keccak256(data),
        proof,
      );

      const treasuryBefore = await usdcToken.balanceOf(treasuryAddr);
      const bondOwner = await owner.getAddress();
      const ownerBefore = await usdcToken.balanceOf(bondOwner);

      await loxley.publishPlaintextOutput(e3Id, data, proof);

      // Pull-payment: treasury and the shared bond owner claim.
      await loxley
        .connect(treasury)
        .treasuryClaim(await usdcToken.getAddress());
      await loxley.connect(owner).claimReward(e3Id);

      const treasuryAfter = await usdcToken.balanceOf(treasuryAddr);
      const ownerAfter = await usdcToken.balanceOf(bondOwner);

      const expectedProtocol = (fee * 182n) / 10000n;
      const expectedCN = fee - expectedProtocol;

      expect(treasuryAfter - treasuryBefore).to.equal(expectedProtocol);
      expect(ownerAfter - ownerBefore).to.equal(expectedCN);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //  Default Pricing Parameters (set in initialize)
  // ──────────────────────────────────────────────────────────────────────────

  describe("Default pricing parameters", function () {
    it("has correct default pricing config from initialize", async function () {
      const { loxley } = await loadFixture(setup);
      const pc = await loxley.getPricingConfig();
      expect(pc.keyGenFixedPerNode).to.equal(100000);
      expect(pc.keyGenPerEncryptionProof).to.equal(50000);
      expect(pc.coordinationPerPair).to.equal(10000);
      expect(pc.availabilityPerNodePerSec).to.equal(50);
      expect(pc.decryptionPerNode).to.equal(300000);
      expect(pc.publicationBase).to.equal(1000000);
      expect(pc.verificationPerProof).to.equal(5000);
      expect(pc.marginBps).to.equal(1000);
      expect(pc.protocolShareBps).to.equal(0);
      expect(pc.dkgUtilizationBps).to.equal(2500);
      expect(pc.computeUtilizationBps).to.equal(5000);
      expect(pc.decryptUtilizationBps).to.equal(2500);
      expect(pc.protocolTreasury).to.equal(ethers.ZeroAddress);
      expect(pc.minCommitteeSize).to.equal(0);
      expect(pc.minThreshold).to.equal(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //  E3 Request with Parametric Pricing (end-to-end)
  // ──────────────────────────────────────────────────────────────────────────

  describe("End-to-end request with parametric pricing", function () {
    it("charges the computed fee and completes successfully", async function () {
      const { loxley, usdcToken, request, owner } = await loadFixture(setup);

      const fee = await loxley.getE3Quote(request);
      const ownerAddr = await owner.getAddress();
      const balanceBefore = await usdcToken.balanceOf(ownerAddr);

      await usdcToken.approve(await loxley.getAddress(), fee);
      await loxley.request(request);

      const balanceAfter = await usdcToken.balanceOf(ownerAddr);
      expect(balanceBefore - balanceAfter).to.equal(fee);
    });

    it("reverts if USDC allowance is less than computed fee", async function () {
      const { loxley, usdcToken, request } = await loadFixture(setup);

      // Approve only 1 unit
      await usdcToken.approve(await loxley.getAddress(), 1);

      await expect(loxley.request(request)).to.be.revertedWithCustomError(
        usdcToken,
        "ERC20InsufficientAllowance",
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //  M-06 — Duration precision (sum-then-divide, not per-term truncation)
  //
  //  With per-term truncation a configuration like windows=2s and utilization
  //  bps=3000 each rounds every term to zero (`2 * 3000 / 10000 == 0`),
  //  losing 1.8 seconds of weight. Sum-then-divide preserves the full
  //  weighted contribution: `(2*3000 + 2*3000 + 2*3000) / 10000 == 1`.
  // ──────────────────────────────────────────────────────────────────────────

  describe("M-06 — duration precision", function () {
    it("sums weighted timeouts before dividing by BPS_BASE", async function () {
      const { loxley, request, ciphernodeRegistryContract, owner } =
        await loadFixture(setup);

      // Configure windows + utilization bps that would round to zero under
      // the old per-term formula but yield exactly 1 extra second under the
      // new sum-then-divide formula.
      await loxley.connect(owner).setTimeoutConfig({
        dkgWindow: 2,
        computeWindow: 2,
        decryptionWindow: 2,
      });

      const pc = await loxley.getPricingConfig();
      await setPricingConfig(loxley.connect(owner), {
        ...toPlainConfig(pc),
        dkgUtilizationBps: 3000,
        computeUtilizationBps: 3000,
        decryptUtilizationBps: 3000,
      });

      const sortitionWindow =
        await ciphernodeRegistryContract.sortitionSubmissionWindow();
      const inputWindowSecs =
        BigInt(request.inputWindow[1]) - BigInt(request.inputWindow[0]);

      // New (correct) formula: sum then divide.
      const newDuration =
        sortitionWindow +
        inputWindowSecs +
        (2n * 3000n + 2n * 3000n + 2n * 3000n) / 10000n; // = +1

      // Old (buggy) per-term formula would have produced this:
      const oldDuration =
        sortitionWindow +
        inputWindowSecs +
        (2n * 3000n) / 10000n + // 0
        (2n * 3000n) / 10000n + // 0
        (2n * 3000n) / 10000n; // 0

      expect(newDuration - oldDuration).to.equal(1n);

      // Compute the expected fee using the new duration.
      const pc2 = await loxley.getPricingConfig();
      const n = 3n;
      const h = 2n;
      const proofsPerNode = 14n + 4n * (n - 1n);
      let baseFee = pc2.keyGenFixedPerNode * n;
      baseFee += pc2.keyGenPerEncryptionProof * n * proofsPerNode;
      if (n > 1n) baseFee += (pc2.coordinationPerPair * n * (n - 1n)) / 2n;
      baseFee += pc2.verificationPerProof * n * proofsPerNode;
      baseFee += pc2.availabilityPerNodePerSec * n * newDuration;
      baseFee += pc2.decryptionPerNode * h;
      if (h > 1n) baseFee += (pc2.coordinationPerPair * h * (h - 1n)) / 2n;
      baseFee += pc2.publicationBase;
      const expectedFee = (baseFee * (10000n + BigInt(pc2.marginBps))) / 10000n;

      // Quote against the same request — only the timeout config changed.
      const actualFee = await loxley.getE3Quote(request);
      expect(actualFee).to.equal(expectedFee);

      // The fee under the old (per-term) formula would have been smaller by
      // exactly `availabilityPerNodePerSec * n * 1s * marginMultiplier`.
      let oldBaseFee = pc2.keyGenFixedPerNode * n;
      oldBaseFee += pc2.keyGenPerEncryptionProof * n * proofsPerNode;
      if (n > 1n) oldBaseFee += (pc2.coordinationPerPair * n * (n - 1n)) / 2n;
      oldBaseFee += pc2.verificationPerProof * n * proofsPerNode;
      oldBaseFee += pc2.availabilityPerNodePerSec * n * oldDuration;
      oldBaseFee += pc2.decryptionPerNode * h;
      if (h > 1n) oldBaseFee += (pc2.coordinationPerPair * h * (h - 1n)) / 2n;
      oldBaseFee += pc2.publicationBase;
      const oldFee = (oldBaseFee * (10000n + BigInt(pc2.marginBps))) / 10000n;

      // The new formula must price strictly higher when the old one truncated.
      expect(actualFee).to.be.gt(oldFee);
    });
  });
});
