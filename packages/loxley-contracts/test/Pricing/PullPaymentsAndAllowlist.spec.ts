// SPDX-License-Identifier: LGPL-3.0-only
//
// Pull-payment + fee-token allow-list integration tests.
import { expect } from "chai";
import type { Signer } from "ethers";

import type { MockBlacklistUSDC } from "../../types";
import { MockFeeOnTransferToken__factory as MockFeeOnTransferTokenFactory } from "../../types";
import {
  ACTIVE_CRYPTO_CONFIG_ID,
  SORTITION_SUBMISSION_WINDOW,
  currentPricingConfig,
  DATA as data,
  deployLoxleySystem,
  encodeMockDkgProof,
  ethers,
  networkHelpers,
  PROOF as proof,
  setPricingConfig,
} from "../fixtures";

const { loadFixture, time } = networkHelpers;

describe("Loxley — pull payments + fee-token allow-list", function () {
  const inputWindowDuration = 300;
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  const setupAndPublishCommittee = async (
    registry: any,
    e3Id: number | bigint,
    publicKey: string,
    operators: Signer[],
  ) => {
    await networkHelpers.mine(1);
    for (const operator of operators) {
      await registry.connect(operator).submitTicket(e3Id, 1);
    }
    await time.increase(SORTITION_SUBMISSION_WINDOW + 1);
    await registry.finalizeCommittee(e3Id);
    const pkCommitment = ethers.keccak256(publicKey);
    await registry.publishCommittee(
      e3Id,
      pkCommitment,
      encodeMockDkgProof(pkCommitment),
      "0x01",
    );
  };

  // Two fixtures: one using vanilla USDC (allow-list tests),
  // one using MockBlacklistUSDC as the fee token (blacklist isolation tests).
  const makeFixture = (useBlacklistToken: boolean) => async () => {
    const sys = await deployLoxleySystem({
      committeeThresholds: [[0, [2, 3]]],
      useBlacklistFeeToken: useBlacklistToken,
    });
    const {
      owner,
      operator1: operator1Maybe,
      operator2: operator2Maybe,
      operator3: operator3Maybe,
      loxley,
      ciphernodeRegistry: ciphernodeRegistryContract,
      bondingRegistry,
      slashingManager,
      e3RefundManager,
      usdcToken: feeToken,
      mocks: { e3Program, decryptionVerifier },
    } = sys;
    const operator1 = operator1Maybe!;
    const operator2 = operator2Maybe!;
    const operator3 = operator3Maybe!;
    const [, , , , , treasury] = await ethers.getSigners();
    const treasuryAddress = await treasury.getAddress();

    // Configure protocol share so treasury actually receives credits
    await setPricingConfig(loxley, {
      keyGenFixedPerNode: 100000n,
      keyGenPerEncryptionProof: 50000n,
      coordinationPerPair: 10000n,
      availabilityPerNodePerSec: 50n,
      decryptionPerNode: 300000n,
      publicationBase: 1000000n,
      verificationPerProof: 5000n,
      protocolTreasury: treasuryAddress,
      marginBps: 1000,
      protocolShareBps: 182, // 1.82% gross ~= 20% of 10% margin
      dkgUtilizationBps: 2500,
      computeUtilizationBps: 5000,
      decryptUtilizationBps: 2500,
      minCommitteeSize: 0,
      minThreshold: 0,
    });

    const now = await time.latest();
    const request = {
      committeeSize: 0,
      inputWindow: [now + 10, now + inputWindowDuration] as [number, number],
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
      expectedFeeToken: await feeToken.getAddress(),
      expectedCryptoConfigId: ACTIVE_CRYPTO_CONFIG_ID,
      maxFee: ethers.MaxUint256,
    };

    return {
      owner,
      operator1,
      operator2,
      operator3,
      treasury,
      loxley,
      ciphernodeRegistryContract,
      bondingRegistry,
      feeToken,
      slashingManager,
      e3RefundManager,
      request,
    };
  };

  const fixturePlain = () => makeFixture(false)();
  const fixtureBlacklist = () => makeFixture(true)();

  const runRequestAndPublish = async (ctx: any) => {
    const {
      loxley,
      operator1,
      operator2,
      operator3,
      ciphernodeRegistryContract,
      feeToken,
      request,
    } = ctx;
    await feeToken.approve(await loxley.getAddress(), ethers.MaxUint256);
    const e3Id = await loxley.nexte3Id();
    await loxley.request(request);
    const nodes = [
      await operator1.getAddress(),
      await operator2.getAddress(),
      await operator3.getAddress(),
    ];
    await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, "0x1234", [
      operator1,
      operator2,
      operator3,
    ]);
    await time.increase(inputWindowDuration + 200);
    await loxley.publishCiphertextOutput(
      e3Id,
      data,
      ethers.keccak256(data),
      proof,
    );
    await loxley.publishPlaintextOutput(e3Id, data, proof);
    return { e3Id, nodes };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // H-01 — per-owner pull rewards
  // ─────────────────────────────────────────────────────────────────────────

  describe("H-01 — pull rewards", function () {
    it("credits the bond owner rather than the hot operator keys", async function () {
      const ctx = await loadFixture(fixturePlain);
      const { loxley, feeToken, owner } = ctx;
      const { e3Id, nodes } = await runRequestAndPublish(ctx);
      const ownerAddress = await owner.getAddress();

      for (const node of nodes) {
        expect(await loxley.pendingReward(e3Id, node)).to.equal(0n);
      }
      const pending = await loxley.pendingReward(e3Id, ownerAddress);
      expect(pending).to.be.gt(0);
      const before = await feeToken.balanceOf(ownerAddress);
      await loxley.connect(owner).claimReward(e3Id);
      expect((await feeToken.balanceOf(ownerAddress)) - before).to.equal(
        pending,
      );
      await expect(
        loxley.connect(owner).claimReward(e3Id),
      ).to.be.revertedWithCustomError(loxley, "NothingToClaim");
    });

    it("claimRewards batches across E3 ids", async function () {
      const ctx = await loadFixture(fixturePlain);
      const { loxley, feeToken, owner, request } = ctx;
      // Two sequential E3s for the same committee.
      const { e3Id: firstE3Id } = await runRequestAndPublish(ctx);
      const now = await time.latest();
      const req2 = {
        ...request,
        inputWindow: [now + 10, now + inputWindowDuration] as [number, number],
      };
      await loxley.request(req2);
      const e3Id2 = firstE3Id + 1n;
      await setupAndPublishCommittee(
        ctx.ciphernodeRegistryContract,
        e3Id2,
        "0x5678",
        [ctx.operator1, ctx.operator2, ctx.operator3],
      );
      await time.increase(inputWindowDuration + 200);
      await loxley.publishCiphertextOutput(
        e3Id2,
        data,
        ethers.keccak256(data),
        proof,
      );
      await loxley.publishPlaintextOutput(
        e3Id2,
        data,
        ethers.concat([proof, ethers.toBeHex(e3Id2, 32)]),
      );

      const ownerAddress = await owner.getAddress();
      const expected =
        (await loxley.pendingReward(firstE3Id, ownerAddress)) +
        (await loxley.pendingReward(e3Id2, ownerAddress));
      const before = await feeToken.balanceOf(ownerAddress);
      await loxley.connect(owner).claimRewards([firstE3Id, e3Id2]);
      const after = await feeToken.balanceOf(ownerAddress);
      expect(after - before).to.equal(expected);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // M-02 — treasury pull (Loxley) + blacklist isolation
  // ─────────────────────────────────────────────────────────────────────────

  describe("M-02 — treasury pull isolates failures", function () {
    it("blacklisting treasury does not brick publishPlaintextOutput; other claimants unaffected", async function () {
      const ctx = await loadFixture(fixtureBlacklist);
      const { loxley, feeToken, treasury, owner } = ctx;
      const treasuryAddr = await treasury.getAddress();
      // Blacklist treasury BEFORE the run.
      const blacklistToken = feeToken as unknown as MockBlacklistUSDC;
      await blacklistToken.blacklist(treasuryAddr);

      const { e3Id } = await runRequestAndPublish(ctx);

      // The bond owner can still claim despite treasury being blacklisted.
      const ownerAddress = await owner.getAddress();
      const ownerBefore = await feeToken.balanceOf(ownerAddress);
      await loxley.connect(owner).claimReward(e3Id);
      expect(await feeToken.balanceOf(ownerAddress)).to.be.gt(ownerBefore);

      // Treasury has credits but the pull reverts because token blocks the transfer.
      const tokenAddr = await feeToken.getAddress();
      expect(
        await loxley.pendingTreasuryClaim(treasuryAddr, tokenAddr),
      ).to.be.gt(0);
      await expect(
        loxley.connect(treasury).treasuryClaim(tokenAddr),
      ).to.be.revertedWithCustomError(feeToken, "Blacklisted");

      // After unblacklisting, treasury can claim what it accrued.
      await blacklistToken.unblacklist(treasuryAddr);
      const credit = await loxley.pendingTreasuryClaim(
        treasuryAddr,
        tokenAddr,
      );
      const before = await feeToken.balanceOf(treasuryAddr);
      await loxley.connect(treasury).treasuryClaim(tokenAddr);
      expect((await feeToken.balanceOf(treasuryAddr)) - before).to.equal(
        credit,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // M-10 — fee-token allow-list
  // ─────────────────────────────────────────────────────────────────────────

  describe("M-10 — fee-token allow-list gates request()", function () {
    it("request reverts FeeTokenNotAllowed when active fee token is de-allow-listed", async function () {
      const ctx = await loadFixture(fixturePlain);
      const { loxley, feeToken, request } = ctx;
      await feeToken.approve(await loxley.getAddress(), ethers.MaxUint256);

      // Disable current fee token via allow-list (token still set on Loxley).
      await loxley.setFeeTokenAllowed(await feeToken.getAddress(), false);
      expect(
        await loxley.isFeeTokenAllowed(await feeToken.getAddress()),
      ).to.eq(false);

      const now = await time.latest();
      const fresh = {
        ...request,
        inputWindow: [now + 10, now + inputWindowDuration] as [number, number],
      };
      await expect(loxley.request(fresh)).to.be.revertedWithCustomError(
        loxley,
        "FeeTokenNotAllowed",
      );

      // Re-allow restores request().
      await loxley.setFeeTokenAllowed(await feeToken.getAddress(), true);
      await loxley.request(fresh); // should not revert
    });
  });

  describe("exact-transfer fee policy", function () {
    it("rejects a request when the fee token short-pays escrow", async function () {
      const ctx = await loadFixture(fixturePlain);
      const { loxley, owner, request } = ctx;
      const feeToken = await new MockFeeOnTransferTokenFactory(owner).deploy(
        100,
      );
      const tokenAddress = await feeToken.getAddress();
      await feeToken.mint(owner, ethers.parseEther("10000"));
      await loxley.connect(owner).setFeeAssetConfig({
        token: tokenAddress,
        expectedDecimals: 18,
        pricing: await currentPricingConfig(loxley),
      });

      const now = await time.latest();
      const fresh = {
        ...request,
        inputWindow: [now + 10, now + inputWindowDuration] as [number, number],
        expectedFeeToken: tokenAddress,
      };
      const fee = await loxley.getE3Quote(fresh);
      await feeToken.connect(owner).approve(await loxley.getAddress(), fee);

      await expect(loxley.connect(owner).request(fresh))
        .to.be.revertedWithCustomError(loxley, "AssetTransferMismatch")
        .withArgs(tokenAddress, fee, fee - (fee * 100n) / 10_000n);
    });
  });
});
