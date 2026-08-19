// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
import { expect } from "chai";

import {
  ACTIVE_CRYPTO_CONFIG_ID,
  ADDRESS_TWO as AddressTwo,
  BFV_PARAMS_DEFAULT,
  buildMockAggregationPublishArgs,
  deployLoxleySystem,
  ENCRYPTION_SCHEME_ID as encryptionSchemeId,
  ethers,
  makeRequest,
  networkHelpers,
  setupAndPublishCommittee,
  DEFAULT_TIMEOUT_CONFIG as timeoutConfig,
} from "./fixtures";

const { loadFixture, time, mine } = networkHelpers;

const uint256ControllerPrefix = (controller: string): bigint =>
  BigInt(controller) << 96n;

describe("Loxley", function () {
  let firstE3Id: bigint;
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const newEncryptionSchemeId =
    "0x0000000000000000000000000000000000000000000000000000000000000002";

  const data = "0xda7a";
  const proof = "0x1337";
  const ciphertextCommitment = ethers.keccak256(data);

  const inputWindowDuration = 300;

  const setup = async () => {
    const sys = await deployLoxleySystem({ wireSlashingManager: true });
    firstE3Id = await sys.loxley.nexte3Id();
    return {
      owner: sys.owner,
      notTheOwner: sys.notTheOwner,
      operator1: sys.operator1!,
      operator2: sys.operator2!,
      operator3: sys.operator3!,
      loxley: sys.loxley,
      ciphernodeRegistryContract: sys.ciphernodeRegistry,
      bondingRegistry: sys.bondingRegistry,
      ciphernodeBondToken: sys.ciphernodeBondToken,
      ticketToken: sys.ticketToken,
      usdcToken: sys.usdcToken,
      slashingManager: sys.slashingManager,
      request: sys.request,
      mocks: {
        ciphertextVerifier: sys.mocks.ciphertextVerifier,
        decryptionVerifier: sys.mocks.decryptionVerifier,
        e3Program: sys.mocks.e3Program,
        mockComputeProvider: sys.mocks.mockComputeProvider,
      },
    };
  };

  const deployUnregisteredE3Program = async () => {
    const e3Program = await ethers.deployContract("MockE3Program");
    await e3Program.waitForDeployment();
    return e3Program;
  };

  describe("constructor / initialize()", function () {
    it("correctly sets owner", async function () {
      const { loxley, owner } = await loadFixture(setup);
      expect(await loxley.owner()).to.equal(await owner.getAddress());
    });

    it("correctly sets ciphernodeRegistry address", async function () {
      const { loxley, ciphernodeRegistryContract } =
        await loadFixture(setup);
      expect(await loxley.ciphernodeRegistry()).to.equal(
        await ciphernodeRegistryContract.getAddress(),
      );
    });

    it("correctly sets max duration", async function () {
      const { loxley } = await loadFixture(setup);
      expect(await loxley.maxDuration()).to.equal(60 * 60 * 24 * 30);
    });

    it("namespaces E3 IDs by the controller address", async function () {
      const { loxley } = await loadFixture(setup);
      expect(await loxley.nexte3Id()).to.equal(
        uint256ControllerPrefix(await loxley.getAddress()),
      );
    });

    it("exposes the crypto configuration accepted by new requests", async function () {
      const { loxley } = await loadFixture(setup);
      expect(await loxley.activeCryptoConfigId()).to.equal(
        ACTIVE_CRYPTO_CONFIG_ID,
      );
    });

    it("registers the initial E3 Program", async function () {
      const {
        loxley,
        mocks: { e3Program },
      } = await loadFixture(setup);
      expect(await loxley.e3Programs(await e3Program.getAddress())).to.be
        .true;
    });
  });

  describe("setMaxDuration()", function () {
    it("reverts if not called by owner", async function () {
      const { loxley, notTheOwner } = await loadFixture(setup);

      await expect(
        loxley
          .connect(notTheOwner)
          .setMaxDuration(1, { from: await notTheOwner.getAddress() }),
      )
        .to.be.revertedWithCustomError(loxley, "OwnableUnauthorizedAccount")
        .withArgs(notTheOwner);
    });
    it("set max duration correctly", async function () {
      const { loxley } = await loadFixture(setup);
      await loxley.setMaxDuration(1);
      expect(await loxley.maxDuration()).to.equal(1);
    });
    it("emits MaxDurationSet event", async function () {
      const { loxley } = await loadFixture(setup);
      await expect(loxley.setMaxDuration(1))
        .to.emit(loxley, "MaxDurationSet")
        .withArgs(1);
    });
  });

  describe("setCiphernodeRegistry()", function () {
    it("reverts if not called by owner", async function () {
      const { loxley, notTheOwner } = await loadFixture(setup);

      await expect(
        loxley.connect(notTheOwner).setCiphernodeRegistry(AddressTwo),
      )
        .to.be.revertedWithCustomError(loxley, "OwnableUnauthorizedAccount")
        .withArgs(notTheOwner);
    });

    it("reverts if given address(0)", async function () {
      const { loxley } = await loadFixture(setup);
      await expect(loxley.setCiphernodeRegistry(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(loxley, "InvalidCiphernodeRegistry")
        .withArgs(ethers.ZeroAddress);
    });

    it("reverts if given address is the same as the current ciphernodeRegistry", async function () {
      const { loxley, ciphernodeRegistryContract } =
        await loadFixture(setup);
      await expect(
        loxley.setCiphernodeRegistry(
          await ciphernodeRegistryContract.getAddress(),
        ),
      )
        .to.be.revertedWithCustomError(loxley, "InvalidCiphernodeRegistry")
        .withArgs(await ciphernodeRegistryContract.getAddress());
    });

    it("sets ciphernodeRegistry correctly", async function () {
      const { loxley } = await deployLoxleySystem({ setupOperators: 0 });
      const replacement = await ethers.deployContract("MockCiphernodeRegistry");
      const replacementAddress = await replacement.getAddress();

      await loxley.setRequestsPaused(true);
      await loxley.setCiphernodeRegistry(replacementAddress);
      expect(await loxley.ciphernodeRegistry()).to.equal(replacementAddress);
    });

    it("rejects a replacement registry with existing members", async function () {
      const { loxley } = await deployLoxleySystem({ setupOperators: 0 });
      const replacement = await ethers.deployContract("MockCiphernodeRegistry");

      await replacement.addCiphernode(AddressTwo);
      await loxley.setRequestsPaused(true);

      await expect(
        loxley.setCiphernodeRegistry(await replacement.getAddress()),
      ).to.be.revertedWithCustomError(
        loxley,
        "DependencyGenerationNotDrained",
      );
    });

    it("emits CiphernodeRegistrySet event", async function () {
      const { loxley } = await deployLoxleySystem({ setupOperators: 0 });
      const replacement = await ethers.deployContract("MockCiphernodeRegistry");
      const replacementAddress = await replacement.getAddress();

      await loxley.setRequestsPaused(true);
      await expect(loxley.setCiphernodeRegistry(replacementAddress))
        .to.emit(loxley, "CiphernodeRegistrySet")
        .withArgs(replacementAddress);
    });
  });

  describe("setParamSet()", function () {
    it("reverts if not called by owner", async function () {
      const { loxley, notTheOwner } = await loadFixture(setup);

      await expect(
        loxley.connect(notTheOwner).setParamSet(0, BFV_PARAMS_DEFAULT),
      )
        .to.be.revertedWithCustomError(loxley, "OwnableUnauthorizedAccount")
        .withArgs(notTheOwner);
    });

    it("keeps only the active circuit parameter set", async function () {
      const { loxley } = await loadFixture(setup);

      expect(await loxley.paramSetRegistry(0)).to.equal(BFV_PARAMS_DEFAULT);
      await expect(
        loxley.setParamSet(1, BFV_PARAMS_DEFAULT),
      ).to.be.revertedWithCustomError(loxley, "UnsupportedCryptoConfig");
    });

    it("does not overwrite the active parameter set", async function () {
      const { loxley } = await loadFixture(setup);

      await expect(loxley.setParamSet(0, BFV_PARAMS_DEFAULT))
        .to.be.revertedWithCustomError(loxley, "ParamSetAlreadyRegistered")
        .withArgs(0);
    });

    it("rejects parameter bytes that do not match the active circuit", async function () {
      const { loxley } = await loadFixture(setup);

      await expect(
        loxley.setParamSet(1, "0x"),
      ).to.be.revertedWithCustomError(loxley, "UnsupportedCryptoConfig");
    });
  });

  describe("getE3()", function () {
    it("reverts if E3 does not exist", async function () {
      const { loxley } = await loadFixture(setup);

      await expect(loxley.getE3(1))
        .to.be.revertedWithCustomError(loxley, "E3DoesNotExist")
        .withArgs(1);
    });

    it("returns correct E3 details", async function () {
      const { loxley, request, usdcToken } = await loadFixture(setup);

      await makeRequest(loxley, usdcToken, {
        committeeSize: request.committeeSize,
        inputWindow: request.inputWindow,
        e3Program: request.e3Program,
        paramSet: request.paramSet,
        computeProviderParams: request.computeProviderParams,
        customParams: request.customParams,
      });

      const e3 = await loxley.getE3(firstE3Id);

      expect(e3.committeeSize).to.equal(request.committeeSize);
      expect(e3.inputWindow[0]).to.equal(request.inputWindow[0]);
      expect(e3.inputWindow[1]).to.equal(request.inputWindow[1]);
      expect(e3.e3Program).to.equal(request.e3Program);
      expect(e3.paramSet).to.equal(request.paramSet);
      expect(await loxley.e3CryptoConfigIds(firstE3Id)).to.equal(
        ACTIVE_CRYPTO_CONFIG_ID,
      );
      expect(e3.decryptionVerifier).to.equal(
        abiCoder.decode(["address"], request.computeProviderParams)[0],
      );
      expect(e3.committeePublicKey).to.equal(ethers.ZeroHash);
      expect(e3.ciphertextOutput).to.equal(ethers.ZeroHash);
      expect(e3.plaintextOutput).to.equal("0x");
    });
  });

  describe("getDecryptionVerifier()", function () {
    it("returns true if encryption scheme is enabled", async function () {
      const { loxley, mocks } = await loadFixture(setup);
      expect(
        await loxley.getDecryptionVerifier(encryptionSchemeId),
      ).to.equal(await mocks.decryptionVerifier.getAddress());
    });

    it("returns false if encryption scheme is not enabled", async function () {
      const { loxley } = await loadFixture(setup);
      expect(
        await loxley.getDecryptionVerifier(newEncryptionSchemeId),
      ).to.equal(ethers.ZeroAddress);
    });
  });

  describe("setDecryptionVerifier()", function () {
    it("reverts if caller is not owner", async function () {
      const { loxley, mocks, notTheOwner } = await loadFixture(setup);

      await expect(
        loxley
          .connect(notTheOwner)
          .setDecryptionVerifier(
            encryptionSchemeId,
            await mocks.decryptionVerifier.getAddress(),
          ),
      )
        .to.be.revertedWithCustomError(loxley, "OwnableUnauthorizedAccount")
        .withArgs(notTheOwner);
    });

    it("reverts if encryption scheme is already enabled", async function () {
      const { loxley, mocks } = await loadFixture(setup);

      await expect(
        loxley.setDecryptionVerifier(
          encryptionSchemeId,
          await mocks.decryptionVerifier.getAddress(),
        ),
      )
        .to.be.revertedWithCustomError(loxley, "InvalidEncryptionScheme")
        .withArgs(encryptionSchemeId);
    });

    it("enabled decryption verifier", async function () {
      const { loxley, mocks } = await loadFixture(setup);

      expect(
        await loxley.setDecryptionVerifier(
          newEncryptionSchemeId,
          await mocks.decryptionVerifier.getAddress(),
        ),
      );
      expect(
        await loxley.getDecryptionVerifier(newEncryptionSchemeId),
      ).to.equal(await mocks.decryptionVerifier.getAddress());
    });

    it("emits EncryptionSchemeEnabled", async function () {
      const { loxley, mocks } = await loadFixture(setup);

      await expect(
        await loxley.setDecryptionVerifier(
          newEncryptionSchemeId,
          await mocks.decryptionVerifier.getAddress(),
        ),
      )
        .to.emit(loxley, "EncryptionSchemeEnabled")
        .withArgs(newEncryptionSchemeId);
    });
  });

  describe("setCiphertextVerifier()", function () {
    it("allows only the owner to set a verifier", async function () {
      const { loxley, mocks, notTheOwner } = await loadFixture(setup);

      await expect(
        loxley
          .connect(notTheOwner)
          .setCiphertextVerifier(
            newEncryptionSchemeId,
            await mocks.ciphertextVerifier.getAddress(),
          ),
      )
        .to.be.revertedWithCustomError(loxley, "OwnableUnauthorizedAccount")
        .withArgs(notTheOwner);
    });

    it("rejects an address without verifier code", async function () {
      const { loxley } = await loadFixture(setup);

      await expect(
        loxley.setCiphertextVerifier(newEncryptionSchemeId, AddressTwo),
      )
        .to.be.revertedWithCustomError(loxley, "InvalidEncryptionScheme")
        .withArgs(newEncryptionSchemeId);
    });

    it("emits the verifier selected for future requests", async function () {
      const { loxley, mocks } = await loadFixture(setup);
      const verifier = await mocks.ciphertextVerifier.getAddress();

      await expect(
        loxley.setCiphertextVerifier(newEncryptionSchemeId, verifier),
      )
        .to.emit(loxley, "CiphertextVerifierSet")
        .withArgs(newEncryptionSchemeId, verifier);
    });
  });

  describe("registerE3Program()", function () {
    it("reverts if not called by owner", async function () {
      const { loxley, notTheOwner } = await loadFixture(setup);

      await expect(loxley.connect(notTheOwner).registerE3Program(AddressTwo))
        .to.be.revertedWithCustomError(loxley, "OwnableUnauthorizedAccount")
        .withArgs(notTheOwner);
    });

    it("reverts if E3 Program is already registered", async function () {
      const {
        loxley,
        mocks: { e3Program },
      } = await loadFixture(setup);
      await expect(loxley.registerE3Program(e3Program))
        .to.be.revertedWithCustomError(loxley, "ModuleAlreadyEnabled")
        .withArgs(e3Program);
    });
    it("reverts if E3 Program is the zero address", async function () {
      const { loxley } = await loadFixture(setup);
      await expect(loxley.registerE3Program(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(loxley, "E3ProgramNotAllowed")
        .withArgs(ethers.ZeroAddress);
    });
    it("reverts if E3 Program has no deployed code", async function () {
      const { loxley } = await loadFixture(setup);
      await expect(loxley.registerE3Program(AddressTwo))
        .to.be.revertedWithCustomError(loxley, "E3ProgramNotAllowed")
        .withArgs(AddressTwo);
    });
    it("registers E3 Program correctly", async function () {
      const { loxley } = await loadFixture(setup);
      const e3Program = await deployUnregisteredE3Program();
      const e3ProgramAddress = await e3Program.getAddress();
      await loxley.registerE3Program(e3ProgramAddress);
      expect(await loxley.e3Programs(e3ProgramAddress)).to.be.true;
    });
    it("emits E3ProgramRegistered event", async function () {
      const { loxley } = await loadFixture(setup);
      const e3Program = await deployUnregisteredE3Program();
      const e3ProgramAddress = await e3Program.getAddress();
      await expect(loxley.registerE3Program(e3ProgramAddress))
        .to.emit(loxley, "E3ProgramRegistered")
        .withArgs(e3ProgramAddress);
    });
  });

  describe("request()", function () {
    it("rejects a fee token that differs from the accepted quote", async function () {
      const { loxley, request } = await loadFixture(setup);
      await expect(
        loxley.request({ ...request, expectedFeeToken: AddressTwo }),
      ).to.be.revertedWithCustomError(loxley, "FeeTokenChanged");
    });

    it("rejects a quote above the requester's fee limit", async function () {
      const { loxley, request } = await loadFixture(setup);
      await expect(
        loxley.request({ ...request, maxFee: 0 }),
      ).to.be.revertedWithCustomError(loxley, "FeeExceedsMaximum");
    });

    it("rejects a circuit configuration that changed after quoting", async function () {
      const { loxley, request } = await loadFixture(setup);
      await expect(
        loxley.request({
          ...request,
          expectedCryptoConfigId: ethers.ZeroHash,
        }),
      ).to.be.revertedWithCustomError(loxley, "CryptoConfigChanged");
    });

    it("reverts if USDC allowance is insufficient", async function () {
      const { loxley, request, usdcToken } = await loadFixture(setup);
      await expect(
        loxley.request({
          committeeSize: request.committeeSize,
          inputWindow: request.inputWindow,
          e3Program: request.e3Program,
          paramSet: request.paramSet,
          computeProviderParams: request.computeProviderParams,
          customParams: request.customParams,
          expectedFeeToken: request.expectedFeeToken,
          expectedCryptoConfigId: request.expectedCryptoConfigId,
          maxFee: request.maxFee,
        }),
      ).to.be.revertedWithCustomError(usdcToken, "ERC20InsufficientAllowance");
    });
    it("reverts if committee size is not configured", async function () {
      const { loxley, request } = await loadFixture(setup);
      const unconfiguredCommitteeSize = 1;
      const unconfiguredParams = {
        committeeSize: unconfiguredCommitteeSize,
        inputWindow: request.inputWindow,
        e3Program: request.e3Program,
        paramSet: request.paramSet,
        computeProviderParams: request.computeProviderParams,
        customParams: request.customParams,
        expectedFeeToken: request.expectedFeeToken,
        expectedCryptoConfigId: request.expectedCryptoConfigId,
        maxFee: request.maxFee,
      };
      await expect(loxley.getE3Quote.staticCall(unconfiguredParams))
        .to.be.revertedWithCustomError(loxley, "CommitteeSizeNotConfigured")
        .withArgs(unconfiguredCommitteeSize);
    });
    it("reverts if total duration is greater than maxDuration", async function () {
      const { loxley, request, usdcToken } = await loadFixture(setup);

      await expect(
        makeRequest(loxley, usdcToken, {
          committeeSize: request.committeeSize,
          inputWindow: [
            request.inputWindow[0],
            Number(request.inputWindow[1]) + time.duration.days(31),
          ],
          e3Program: request.e3Program,
          paramSet: request.paramSet,
          computeProviderParams: request.computeProviderParams,
          customParams: request.customParams,
        }),
      ).to.be.revertedWithCustomError(loxley, "InvalidDuration");
    });
    it("allows total duration equal to maxDuration", async function () {
      const { loxley, request, usdcToken } = await loadFixture(setup);
      const requestAt = BigInt((await time.latest()) + 10);
      const maxDuration = await loxley.maxDuration();
      const inputEnd =
        requestAt +
        maxDuration -
        BigInt(timeoutConfig.computeWindow) -
        BigInt(timeoutConfig.decryptionWindow);
      const exactDurationRequest = {
        ...request,
        inputWindow: [requestAt, inputEnd] as [bigint, bigint],
      };
      await usdcToken.approve(await loxley.getAddress(), ethers.MaxUint256);
      await time.setNextBlockTimestamp(requestAt);

      await loxley.request(exactDurationRequest);
      const e3Id = uint256ControllerPrefix(await loxley.getAddress());
      expect(await loxley.nexte3Id()).to.equal(e3Id + 1n);
    });
    it("allows compute to start after a late committee finalization", async function () {
      const { loxley, ciphernodeRegistryContract, request, usdcToken } =
        await loadFixture(setup);
      const sortitionWindow = time.duration.days(1);
      const now = await time.latest();
      const impossibleRequest = {
        ...request,
        inputWindow: [now + 10, now + 20] as [number, number],
      };

      await ciphernodeRegistryContract.setSortitionSubmissionWindow(
        sortitionWindow,
      );
      await usdcToken.approve(await loxley.getAddress(), ethers.MaxUint256);
      await loxley.request(impossibleRequest);
      const e3Id = uint256ControllerPrefix(await loxley.getAddress());
      expect(await loxley.nexte3Id()).to.equal(e3Id + 1n);
      expect(await loxley.getE3LifecycleDeadline(e3Id)).to.be.gt(
        impossibleRequest.inputWindow[1],
      );
    });
    it("reverts if E3 Program is not enabled", async function () {
      const { loxley, request, usdcToken } = await loadFixture(setup);

      await expect(
        makeRequest(loxley, usdcToken, {
          committeeSize: request.committeeSize,
          inputWindow: request.inputWindow,
          e3Program: ethers.ZeroAddress,
          paramSet: request.paramSet,
          computeProviderParams: request.computeProviderParams,
          customParams: request.customParams,
        }),
      )
        .to.be.revertedWithCustomError(loxley, "E3ProgramNotAllowed")
        .withArgs(ethers.ZeroAddress);
    });
    it("instantiates a new E3", async function () {
      const { loxley, request, usdcToken } = await loadFixture(setup);

      await makeRequest(loxley, usdcToken, {
        committeeSize: request.committeeSize,
        inputWindow: request.inputWindow,
        e3Program: request.e3Program,
        paramSet: request.paramSet,
        computeProviderParams: request.computeProviderParams,
        customParams: request.customParams,
      });

      const e3 = await loxley.getE3(firstE3Id);
      const block = await ethers.provider.getBlock("latest").catch((e) => e);

      expect(e3.committeeSize).to.equal(request.committeeSize);
      expect(e3.inputWindow[0]).to.equal(request.inputWindow[0]);
      expect(e3.inputWindow[1]).to.equal(request.inputWindow[1]);
      expect(e3.e3Program).to.equal(request.e3Program);
      // H-26: `requestBlock` now stores `block.timestamp` (a stable EIP-6372
      // clock) instead of `block.number`, so the snapshot agrees with the
      // bonding registry / token checkpoints across L2s with variable block
      // production.
      expect(e3.requestBlock).to.equal(block.timestamp);
      expect(e3.decryptionVerifier).to.equal(
        abiCoder.decode(["address"], request.computeProviderParams)[0],
      );
      expect(e3.committeePublicKey).to.equal(ethers.ZeroHash);
      expect(e3.ciphertextOutput).to.equal(ethers.ZeroHash);
      expect(e3.plaintextOutput).to.equal("0x");
    });
    it("emits E3Requested event", async function () {
      const { loxley, request, usdcToken } = await loadFixture(setup);
      const tx = await makeRequest(loxley, usdcToken, {
        committeeSize: request.committeeSize,
        inputWindow: request.inputWindow,
        e3Program: request.e3Program,
        paramSet: request.paramSet,
        computeProviderParams: request.computeProviderParams,
        customParams: request.customParams,
      });
      const e3 = await loxley.getE3(firstE3Id);

      await expect(tx)
        .to.emit(loxley, "E3Requested")
        .withArgs(firstE3Id, e3, ACTIVE_CRYPTO_CONFIG_ID);
    });
  });

  describe("publishCiphertextOutput()", function () {
    it("reverts if E3 does not exist", async function () {
      const { loxley } = await loadFixture(setup);

      await expect(
        loxley.publishCiphertextOutput(0, "0x", ethers.ZeroHash, "0x"),
      )
        .to.be.revertedWithCustomError(loxley, "E3DoesNotExist")
        .withArgs(0);
    });

    it("reverts if output has already been published", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
      } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        committeeSize: request.committeeSize,
        inputWindow: request.inputWindow,
        e3Program: request.e3Program,
        paramSet: request.paramSet,
        computeProviderParams: request.computeProviderParams,
        customParams: request.customParams,
      });

      await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, data, [
        operator1,
        operator2,
        operator3,
      ]);
      await mine(2, { interval: inputWindowDuration });

      await loxley.publishCiphertextOutput(
        e3Id,
        data,
        ciphertextCommitment,
        proof,
      );
      await expect(
        loxley.publishCiphertextOutput(
          e3Id,
          data,
          ciphertextCommitment,
          proof,
        ),
      )
        .to.be.revertedWithCustomError(loxley, "InvalidStage")
        .withArgs(e3Id, 3, 4);
    });
    it("reverts if committee duties are over", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
      } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        ...request,
        inputWindow: [(await time.latest()) + 20, (await time.latest()) + 100],
      });

      await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, data, [
        operator1,
        operator2,
        operator3,
      ]);
      await mine(2, {
        interval: inputWindowDuration + timeoutConfig.computeWindow,
      });
      await expect(
        loxley.publishCiphertextOutput(
          e3Id,
          data,
          ciphertextCommitment,
          proof,
        ),
      ).to.be.revertedWithCustomError(loxley, "CommitteeDutiesCompleted");
    });
    it("reverts if output is not valid", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
      } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        committeeSize: request.committeeSize,
        inputWindow: [(await time.latest()) + 20, (await time.latest()) + 100],
        e3Program: request.e3Program,
        paramSet: request.paramSet,
        computeProviderParams: request.computeProviderParams,
        customParams: request.customParams,
      });

      await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, data, [
        operator1,
        operator2,
        operator3,
      ]);
      await mine(2, { interval: inputWindowDuration });
      await expect(
        loxley.publishCiphertextOutput(e3Id, "0x", ethers.ZeroHash, "0x"),
      ).to.be.revertedWithCustomError(loxley, "InvalidOutput");
    });
    it("does not assign an unverified ciphertext to the committee", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
        mocks,
      } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        ...request,
        inputWindow: [(await time.latest()) + 20, (await time.latest()) + 100],
      });
      await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, data, [
        operator1,
        operator2,
        operator3,
      ]);
      await mine(2, { interval: inputWindowDuration });
      await mocks.ciphertextVerifier.setResult(false);

      await expect(
        loxley.publishCiphertextOutput(
          e3Id,
          data,
          ciphertextCommitment,
          proof,
        ),
      ).to.be.revertedWithCustomError(loxley, "InvalidOutput");
      expect(await loxley.getE3Stage(e3Id)).to.equal(3);
      const e3 = await loxley.getE3(e3Id);
      expect(e3.ciphertextOutput).to.equal(ethers.ZeroHash);
      expect(e3.ciphertextCommitment).to.equal(ethers.ZeroHash);
    });
    it("keeps the request-time verifier after verifier rotation", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
        mocks,
      } = await loadFixture(setup);
      const replacement = await ethers.deployContract("MockCiphertextVerifier");
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        ...request,
        inputWindow: [(await time.latest()) + 20, (await time.latest()) + 100],
      });
      await loxley.setCiphertextVerifier(
        encryptionSchemeId,
        await replacement.getAddress(),
      );
      await mocks.ciphertextVerifier.setResult(false);
      await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, data, [
        operator1,
        operator2,
        operator3,
      ]);
      await mine(2, { interval: inputWindowDuration });

      await expect(
        loxley.publishCiphertextOutput(
          e3Id,
          data,
          ciphertextCommitment,
          proof,
        ),
      ).to.be.revertedWithCustomError(loxley, "InvalidOutput");

      await mocks.ciphertextVerifier.setResult(true);
      await replacement.setResult(false);
      await expect(
        loxley.publishCiphertextOutput(
          e3Id,
          data,
          ciphertextCommitment,
          proof,
        ),
      ).to.emit(loxley, "CiphertextOutputPublished");
    });
    it("sets ciphertextOutput correctly", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
        mocks,
      } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        ...request,
        inputWindow: [(await time.latest()) + 20, (await time.latest()) + 100],
      });

      await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, data, [
        operator1,
        operator2,
        operator3,
      ]);
      await mine(2, { interval: inputWindowDuration });
      await mocks.e3Program.setExpectedCiphertextCommitment(
        e3Id,
        ciphertextCommitment,
      );
      await expect(
        loxley.publishCiphertextOutput(
          e3Id,
          data,
          ethers.keccak256("0xbad0"),
          proof,
        ),
      ).to.be.revertedWithCustomError(loxley, "InvalidOutput");
      await loxley.publishCiphertextOutput(
        e3Id,
        data,
        ciphertextCommitment,
        proof,
      );
      const e3 = await loxley.getE3(e3Id);
      expect(e3.ciphertextOutput).to.equal(ethers.keccak256(data));
      expect(e3.ciphertextCommitment).to.equal(ciphertextCommitment);
    });

    it("returns true if output is published successfully", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
      } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        ...request,
        inputWindow: [(await time.latest()) + 20, (await time.latest()) + 100],
      });

      await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, data, [
        operator1,
        operator2,
        operator3,
      ]);
      await mine(2, { interval: inputWindowDuration });
      expect(
        await loxley.publishCiphertextOutput.staticCall(
          e3Id,
          data,
          ciphertextCommitment,
          proof,
        ),
      ).to.equal(true);
    });
    it("emits CiphertextOutputPublished event", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
      } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        ...request,
        inputWindow: [(await time.latest()) + 20, (await time.latest()) + 100],
      });

      await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, data, [
        operator1,
        operator2,
        operator3,
      ]);
      await mine(2, { interval: inputWindowDuration });
      await expect(
        loxley.publishCiphertextOutput(
          e3Id,
          data,
          ciphertextCommitment,
          proof,
        ),
      )
        .to.emit(loxley, "CiphertextOutputPublished")
        .withArgs(e3Id, data, ciphertextCommitment);
    });

    it("blocks plaintext publication during ciphertext verification", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
        mocks,
      } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        ...request,
        inputWindow: [(await time.latest()) + 20, (await time.latest()) + 100],
      });
      await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, data, [
        operator1,
        operator2,
        operator3,
      ]);
      await mine(2, { interval: inputWindowDuration });
      await mocks.e3Program.setReentrantPlaintextPublication(data, proof);

      await expect(
        loxley.publishCiphertextOutput(
          e3Id,
          data,
          ciphertextCommitment,
          proof,
        ),
      ).to.be.revertedWithCustomError(
        loxley,
        "ReentrancyGuardReentrantCall",
      );
      expect(await loxley.getE3Stage(e3Id)).to.equal(3);
    });
  });

  describe("publishPlaintextOutput()", function () {
    it("reverts if E3 does not exist", async function () {
      const { loxley } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await expect(loxley.publishPlaintextOutput(e3Id, data, "0x"))
        .to.be.revertedWithCustomError(loxley, "E3DoesNotExist")
        .withArgs(e3Id);
    });

    it("reverts if ciphertextOutput has not been published", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
      } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        ...request,
        inputWindow: [(await time.latest()) + 20, (await time.latest()) + 100],
      });

      await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, data, [
        operator1,
        operator2,
        operator3,
      ]);
      await expect(
        loxley.publishPlaintextOutput(e3Id, data, "0x"),
      ).to.be.revertedWithCustomError(loxley, "InvalidStage");
    });
    it("reverts if plaintextOutput has already been published", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
      } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        ...request,
        inputWindow: [(await time.latest()) + 20, (await time.latest()) + 100],
      });

      await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, data, [
        operator1,
        operator2,
        operator3,
      ]);
      await mine(2, { interval: inputWindowDuration });
      await loxley.publishCiphertextOutput(
        e3Id,
        data,
        ciphertextCommitment,
        proof,
      );
      await loxley.publishPlaintextOutput(e3Id, data, proof);
      await expect(
        loxley.publishPlaintextOutput(e3Id, data, proof),
      ).to.be.revertedWithCustomError(loxley, "InvalidStage");
    });
    it("AUD-C02: requires a final decryption proof", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
      } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        ...request,
        inputWindow: [(await time.latest()) + 20, (await time.latest()) + 100],
      });
      await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, data, [
        operator1,
        operator2,
        operator3,
      ]);
      await mine(2, { interval: inputWindowDuration });
      await loxley.publishCiphertextOutput(
        e3Id,
        data,
        ciphertextCommitment,
        proof,
      );

      await expect(
        loxley.publishPlaintextOutput(e3Id, data, "0x"),
      ).to.be.revertedWithCustomError(loxley, "ProofRequired");
    });
    it("reverts if output is not valid", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
      } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        ...request,
        inputWindow: [(await time.latest()) + 20, (await time.latest()) + 100],
      });

      const operators = [operator1, operator2, operator3];
      const { proof, bundle } = await buildMockAggregationPublishArgs(
        operators,
        e3Id,
        data,
        await ciphernodeRegistryContract.dkgFoldAttestationVerifier(),
        await ciphernodeRegistryContract.getAddress(),
      );
      await setupAndPublishCommittee(
        ciphernodeRegistryContract,
        e3Id,
        data,
        operators,
        proof,
        bundle,
      );
      await mine(2, { interval: inputWindowDuration });
      await loxley.publishCiphertextOutput(
        e3Id,
        data,
        ciphertextCommitment,
        proof,
      );
      // M-35: decryption verifier now reverts with a typed error instead of
      // returning false, so the call reverts before Loxley's own InvalidOutput
      // wrapping (which now only guards ciphertext output).
      await expect(
        loxley.publishPlaintextOutput(e3Id, data, "0xdeadbeef"),
      ).to.be.revert(ethers);
    });
    it("rejects a false decryption verifier result", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
        mocks,
      } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        ...request,
        inputWindow: [(await time.latest()) + 20, (await time.latest()) + 100],
      });
      await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, data, [
        operator1,
        operator2,
        operator3,
      ]);
      await mine(2, { interval: inputWindowDuration });
      await loxley.publishCiphertextOutput(
        e3Id,
        data,
        ciphertextCommitment,
        proof,
      );

      await expect(
        loxley.publishPlaintextOutput(e3Id, data, "0xfafafafa"),
      ).to.be.revertedWithCustomError(mocks.decryptionVerifier, "InvalidProof");
    });
    it("sets plaintextOutput correctly", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
      } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        ...request,
        inputWindow: [(await time.latest()) + 20, (await time.latest()) + 100],
      });

      await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, data, [
        operator1,
        operator2,
        operator3,
      ]);
      await mine(2, { interval: inputWindowDuration });
      await loxley.publishCiphertextOutput(
        e3Id,
        data,
        ciphertextCommitment,
        proof,
      );
      expect(await loxley.publishPlaintextOutput(e3Id, data, proof));

      const e3 = await loxley.getE3(e3Id);
      expect(e3.plaintextOutput).to.equal(data);
    });
    it("returns true if output is published successfully", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
      } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        ...request,
        inputWindow: [(await time.latest()) + 20, (await time.latest()) + 100],
      });

      await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, data, [
        operator1,
        operator2,
        operator3,
      ]);
      await mine(2, { interval: inputWindowDuration });
      await loxley.publishCiphertextOutput(
        e3Id,
        data,
        ciphertextCommitment,
        proof,
      );
      expect(
        await loxley.publishPlaintextOutput.staticCall(e3Id, data, proof),
      ).to.equal(true);
    });
    it("emits PlaintextOutputPublished event", async function () {
      const {
        loxley,
        request,
        usdcToken,
        ciphernodeRegistryContract,
        operator1,
        operator2,
        operator3,
      } = await loadFixture(setup);
      const e3Id = firstE3Id;

      await makeRequest(loxley, usdcToken, {
        ...request,
        inputWindow: [(await time.latest()) + 20, (await time.latest()) + 100],
      });

      await setupAndPublishCommittee(ciphernodeRegistryContract, e3Id, data, [
        operator1,
        operator2,
        operator3,
      ]);
      await mine(2, { interval: inputWindowDuration });
      await loxley.publishCiphertextOutput(
        e3Id,
        data,
        ciphertextCommitment,
        proof,
      );
      await expect(await loxley.publishPlaintextOutput(e3Id, data, proof))
        .to.emit(loxley, "PlaintextOutputPublished")
        .withArgs(e3Id, data, proof);
    });
  });
});
