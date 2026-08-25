// SPDX-License-Identifier: LGPL-3.0-only
//
// Governance — access control, bounds, events, Ownable2Step.
// Covers Ownable2Step + renounceOwnership disabling on the four
// upgradeable contracts and the two ERC20 tokens, public bounds on
// Bracken / CiphernodeRegistry / BondingRegistry / E3RefundManager /
// SlashingManager, the BondingRegistry distributor cap, the PkVerifierSet / SlashingManager setter events, the
// SortitionCommitteeFinalized event rename, and append-only parameter sets.
import { expect } from "chai";

import { BFV_PARAMS_DEFAULT, deployBrackenSystem, ethers } from "../fixtures";

async function deployAll() {
  const sys = await deployBrackenSystem({
    setupOperators: 0,
    wireSlashingManager: false,
  });
  // The fixture wires `bracken` as a reward distributor; the distributor
  // cap test assumes a clean slate. Revoke it here so the cap counts
  // start at zero.
  await sys.bondingRegistry.revokeRewardDistributor(
    await sys.bracken.getAddress(),
  );
  return {
    ...sys,
    other: sys.notTheOwner,
    ownerAddress: await sys.owner.getAddress(),
  };
}

describe("Governance — access control, bounds & events", function () {
  describe("Ownable2Step + renounceOwnership disabled", function () {
    it("Bracken: transferOwnership is two-step", async function () {
      const { bracken, other, ownerAddress } = await deployAll();
      const otherAddress = await other.getAddress();
      await bracken.transferOwnership(otherAddress);
      expect(await bracken.owner()).to.equal(ownerAddress);
      expect(await bracken.pendingOwner()).to.equal(otherAddress);
      await bracken.connect(other).acceptOwnership();
      expect(await bracken.owner()).to.equal(otherAddress);
    });

    it("CiphernodeRegistry: transferOwnership is two-step", async function () {
      const { ciphernodeRegistry, other, ownerAddress } = await deployAll();
      const otherAddress = await other.getAddress();
      await ciphernodeRegistry.transferOwnership(otherAddress);
      expect(await ciphernodeRegistry.owner()).to.equal(ownerAddress);
      expect(await ciphernodeRegistry.pendingOwner()).to.equal(otherAddress);
      await ciphernodeRegistry.connect(other).acceptOwnership();
      expect(await ciphernodeRegistry.owner()).to.equal(otherAddress);
    });

    it("BondingRegistry: transferOwnership is two-step", async function () {
      const { bondingRegistry, other, ownerAddress } = await deployAll();
      const otherAddress = await other.getAddress();
      await bondingRegistry.transferOwnership(otherAddress);
      expect(await bondingRegistry.owner()).to.equal(ownerAddress);
      expect(await bondingRegistry.pendingOwner()).to.equal(otherAddress);
      await bondingRegistry.connect(other).acceptOwnership();
      expect(await bondingRegistry.owner()).to.equal(otherAddress);
    });

    it("E3RefundManager: transferOwnership is two-step", async function () {
      const { e3RefundManager, other, ownerAddress } = await deployAll();
      const otherAddress = await other.getAddress();
      await e3RefundManager.transferOwnership(otherAddress);
      expect(await e3RefundManager.owner()).to.equal(ownerAddress);
      expect(await e3RefundManager.pendingOwner()).to.equal(otherAddress);
      await e3RefundManager.connect(other).acceptOwnership();
      expect(await e3RefundManager.owner()).to.equal(otherAddress);
    });

    it("BrackenToken: renounceOwnership reverts", async function () {
      const { ciphernodeBondToken } = await deployAll();
      await expect(
        ciphernodeBondToken.renounceOwnership(),
      ).to.be.revertedWithCustomError(
        ciphernodeBondToken,
        "RenounceOwnershipDisabled",
      );
    });

    it("BrackenTicketToken: renounceOwnership reverts", async function () {
      const { ticketToken } = await deployAll();
      await expect(
        ticketToken.renounceOwnership(),
      ).to.be.revertedWithCustomError(ticketToken, "RenounceOwnershipDisabled");
    });

    it("Bracken: renounceOwnership reverts", async function () {
      const { bracken } = await deployAll();
      await expect(bracken.renounceOwnership()).to.be.revertedWithCustomError(
        bracken,
        "RenounceOwnershipDisabled",
      );
    });

    it("CiphernodeRegistry: renounceOwnership reverts", async function () {
      const { ciphernodeRegistry } = await deployAll();
      await expect(
        ciphernodeRegistry.renounceOwnership(),
      ).to.be.revertedWithCustomError(
        ciphernodeRegistry,
        "RenounceOwnershipDisabled",
      );
    });

    it("BondingRegistry: renounceOwnership reverts", async function () {
      const { bondingRegistry } = await deployAll();
      await expect(
        bondingRegistry.renounceOwnership(),
      ).to.be.revertedWithCustomError(
        bondingRegistry,
        "RenounceOwnershipDisabled",
      );
    });

    it("E3RefundManager: renounceOwnership reverts", async function () {
      const { e3RefundManager } = await deployAll();
      await expect(
        e3RefundManager.renounceOwnership(),
      ).to.be.revertedWithCustomError(
        e3RefundManager,
        "RenounceOwnershipDisabled",
      );
    });
  });

  describe("Bracken bounds exposed", function () {
    it("setMaxDuration reverts above MAX_DURATION_CAP", async function () {
      const { bracken } = await deployAll();
      const cap = await bracken.MAX_DURATION_CAP();
      await expect(
        bracken.setMaxDuration(cap + 1n),
      ).to.be.revertedWithCustomError(bracken, "InvalidDuration");
    });

    it("exposes MAX_TIMEOUT_WINDOW / MAX_COMMITTEE_SIZE / MAX_*_BPS", async function () {
      const { bracken } = await deployAll();
      expect(await bracken.MAX_DURATION_CAP()).to.equal(365n * 24n * 60n * 60n);
      expect(await bracken.MAX_TIMEOUT_WINDOW()).to.equal(30n * 24n * 60n * 60n);
      expect(await bracken.MAX_COMMITTEE_SIZE()).to.equal(3n);
      expect(await bracken.MAX_MARGIN_BPS()).to.equal(5_000n);
      expect(await bracken.MAX_PROTOCOL_SHARE_BPS()).to.equal(5_000n);
    });
  });

  describe("registry & bonding bounds", function () {
    it("setSortitionSubmissionWindow reverts when out of bounds", async function () {
      const { ciphernodeRegistry } = await deployAll();
      await expect(
        ciphernodeRegistry.setSortitionSubmissionWindow(0),
      ).to.be.revertedWithCustomError(
        ciphernodeRegistry,
        "SortitionSubmissionWindowOutOfBounds",
      );
      const max = await ciphernodeRegistry.MAX_SORTITION_SUBMISSION_WINDOW();
      await expect(
        ciphernodeRegistry.setSortitionSubmissionWindow(max + 1n),
      ).to.be.revertedWithCustomError(
        ciphernodeRegistry,
        "SortitionSubmissionWindowOutOfBounds",
      );
    });

    it("BondingRegistry.setExitDelay reverts when out of bounds", async function () {
      const { bondingRegistry } = await deployAll();
      const min = await bondingRegistry.MIN_EXIT_DELAY();
      await expect(
        bondingRegistry.setExitDelay(min - 1n),
      ).to.be.revertedWithCustomError(bondingRegistry, "ExitDelayOutOfBounds");
      const max = await bondingRegistry.MAX_EXIT_DELAY();
      await expect(
        bondingRegistry.setExitDelay(max + 1n),
      ).to.be.revertedWithCustomError(bondingRegistry, "ExitDelayOutOfBounds");
    });

    it("keeps exit delay longer than the sortition window", async function () {
      const { bondingRegistry, ciphernodeRegistry } = await deployAll();
      const minimumExitDelay = await bondingRegistry.MIN_EXIT_DELAY();
      await bondingRegistry.setExitDelay(minimumExitDelay);
      await expect(
        ciphernodeRegistry.setSortitionSubmissionWindow(minimumExitDelay),
      )
        .to.be.revertedWithCustomError(
          ciphernodeRegistry,
          "ExitDelayMustExceedSortitionWindow",
        )
        .withArgs(minimumExitDelay, minimumExitDelay);

      await bondingRegistry.setExitDelay(minimumExitDelay + 1n);
      await ciphernodeRegistry.setSortitionSubmissionWindow(minimumExitDelay);
      await expect(bondingRegistry.setExitDelay(minimumExitDelay))
        .to.be.revertedWithCustomError(
          bondingRegistry,
          "ExitDelayMustExceedSortitionWindow",
        )
        .withArgs(minimumExitDelay, minimumExitDelay);
    });
  });

  describe("bps and appeal-window caps exposed", function () {
    it("E3RefundManager exposes MAX_PROTOCOL_BPS", async function () {
      const { e3RefundManager } = await deployAll();
      expect(await e3RefundManager.MAX_PROTOCOL_BPS()).to.equal(5_000n);
    });

    it("SlashingManager exposes MAX_APPEAL_WINDOW", async function () {
      const { slashingManager } = await deployAll();
      expect(await slashingManager.MAX_APPEAL_WINDOW()).to.equal(
        30n * 24n * 60n * 60n,
      );
    });
  });

  describe("BondingRegistry distributor cap", function () {
    it("reverts after MAX_AUTHORIZED_DISTRIBUTORS, succeeds after revoke", async function () {
      const { bondingRegistry } = await deployAll();
      const cap = await bondingRegistry.MAX_AUTHORIZED_DISTRIBUTORS();
      const distributors: string[] = [];
      for (let i = 0; i < Number(cap); i++) {
        const w = ethers.Wallet.createRandom();
        distributors.push(w.address);
        await bondingRegistry.setRewardDistributor(w.address);
      }
      const extra = ethers.Wallet.createRandom();
      await expect(
        bondingRegistry.setRewardDistributor(extra.address),
      ).to.be.revertedWithCustomError(
        bondingRegistry,
        "MaxAuthorizedDistributors",
      );
      await bondingRegistry.revokeRewardDistributor(distributors[0]!);
      await bondingRegistry.setRewardDistributor(extra.address);
    });
  });

  describe("PkVerifierSet event", function () {
    it("emits PkVerifierSet when setPkVerifier is called", async function () {
      const { bracken, mocks } = await deployAll();
      const schemeId = ethers.id("pk-verifier-event");
      const verifier = await mocks.pkVerifier.getAddress();
      await expect(bracken.setPkVerifier(schemeId, verifier))
        .to.emit(bracken, "PkVerifierSet")
        .withArgs(schemeId, verifier);
    });

    it("rejects verifiers compiled for another committee", async function () {
      const { bracken, ciphernodeRegistry } = await deployAll();
      const circuitVerifier = await ethers.deployContract(
        "MockCircuitVerifier",
      );
      const vkHashA = ethers.id("vk-a");
      const vkHashB = ethers.id("vk-b");
      const wrongPkVerifier = await ethers.deployContract("BfvPkVerifier", [
        await circuitVerifier.getAddress(),
        vkHashA,
        vkHashB,
        5,
      ]);
      const wrongDecryptionVerifier = await ethers.deployContract(
        "BfvDecryptionVerifier",
        [
          await circuitVerifier.getAddress(),
          await ciphernodeRegistry.getAddress(),
          vkHashA,
          vkHashB,
          4,
        ],
      );
      const schemeId = ethers.id("wrong-committee");

      await expect(
        bracken.setPkVerifier(schemeId, await wrongPkVerifier.getAddress()),
      )
        .to.be.revertedWithCustomError(bracken, "VerifierThresholdMismatch")
        .withArgs(5, 2);
      await expect(
        bracken.setDecryptionVerifier(
          schemeId,
          await wrongDecryptionVerifier.getAddress(),
        ),
      )
        .to.be.revertedWithCustomError(bracken, "VerifierThresholdMismatch")
        .withArgs(4, 1);
    });
  });

  describe("SlashingManager setter events", function () {
    it("emits BondingRegistryUpdated", async function () {
      const { slashingManager } = await deployAll();
      const target = ethers.Wallet.createRandom().address;
      await expect(slashingManager.setBondingRegistry(target)).to.emit(
        slashingManager,
        "BondingRegistryUpdated",
      );
    });
  });

  describe("SortitionCommitteeFinalized event rename", function () {
    it("ABI exposes SortitionCommitteeFinalized but not CommitteeFinalized", async function () {
      const { ciphernodeRegistry } = await deployAll();
      expect(
        ciphernodeRegistry.interface.getEvent("SortitionCommitteeFinalized"),
      ).to.not.equal(null);
      expect(
        ciphernodeRegistry.interface.getEvent(
          "CommitteeFinalized" as unknown as "SortitionCommitteeFinalized",
        ),
      ).to.equal(null);
    });
  });

  describe("active parameter set", function () {
    it("is append-only", async function () {
      const { bracken } = await deployAll();
      await expect(bracken.setParamSet(0, BFV_PARAMS_DEFAULT))
        .to.be.revertedWithCustomError(bracken, "ParamSetAlreadyRegistered")
        .withArgs(0);
    });
  });
});
