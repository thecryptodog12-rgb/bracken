// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
// Full Loxley system deployment used by spec files. Composes the existing
// ignition modules + token/registry/slashing wiring + (optional) operator
// onboarding into one entry point: `deployLoxleySystem(opts?)`.
import type { Signer } from "ethers";

import BondingRegistryModule from "../../ignition/modules/bondingRegistry";
import CiphernodeRegistryModule from "../../ignition/modules/ciphernodeRegistry";
import E3RefundManagerModule from "../../ignition/modules/e3RefundManager";
import LoxleyModule from "../../ignition/modules/loxley";
import LoxleyTicketTokenModule from "../../ignition/modules/loxleyTicketToken";
import LoxleyTokenModule from "../../ignition/modules/loxleyToken";
import MockCiphernodeRegistryModule from "../../ignition/modules/mockCiphernodeRegistry";
import MockCiphertextVerifierModule from "../../ignition/modules/mockCiphertextVerifier";
import mockComputeProviderModule from "../../ignition/modules/mockComputeProvider";
import MockDecryptionVerifierModule from "../../ignition/modules/mockDecryptionVerifier";
import MockE3ProgramModule from "../../ignition/modules/mockE3Program";
import MockPkVerifierModule from "../../ignition/modules/mockPkVerifier";
import MockCircuitVerifierModule from "../../ignition/modules/mockSlashingVerifier";
import MockStableTokenModule from "../../ignition/modules/mockStableToken";
import SlashingManagerModule from "../../ignition/modules/slashingManager";
import {
  BondingRegistry__factory as BondingRegistryFactory,
  CiphernodeRegistryOwnable__factory as CiphernodeRegistryOwnableFactory,
  E3RefundManager__factory as E3RefundManagerFactory,
  Loxley__factory as LoxleyFactory,
  LoxleyTicketToken__factory as LoxleyTicketTokenFactory,
  LoxleyToken__factory as LoxleyTokenFactory,
  MockBlacklistUSDC__factory as MockBlacklistUSDCFactory,
  MockCiphernodeRegistry__factory as MockCiphernodeRegistryFactory,
  MockCiphertextVerifier__factory as MockCiphertextVerifierFactory,
  MockCircuitVerifier__factory as MockCircuitVerifierFactory,
  MockDecryptionVerifier__factory as MockDecryptionVerifierFactory,
  MockE3ProgramHarness__factory as MockE3ProgramFactory,
  MockPkVerifier__factory as MockPkVerifierFactory,
  MockUSDC__factory as MockUSDCFactory,
  SlashingManager__factory as SlashingManagerFactory,
} from "../../types";
import type { E3RefundManager } from "../../types/contracts/E3RefundManager";
import type { ILoxley, Loxley } from "../../types/contracts/Loxley";
import type { BondingRegistry } from "../../types/contracts/registry/BondingRegistry";
import type { CiphernodeRegistryOwnable } from "../../types/contracts/registry/CiphernodeRegistryOwnable";
import type { SlashingManager } from "../../types/contracts/slashing/SlashingManager";
import type { MockCiphernodeRegistry } from "../../types/contracts/test/MockCiphernodeRegistry.sol/MockCiphernodeRegistry";
import type { MockCiphertextVerifier } from "../../types/contracts/test/MockCiphertextVerifier";
import type { MockComputeProvider } from "../../types/contracts/test/MockComputeProvider";
import type { MockDecryptionVerifier } from "../../types/contracts/test/MockDecryptionVerifier";
import type { MockE3ProgramHarness } from "../../types/contracts/test/MockE3ProgramHarness";
import type { MockPkVerifier } from "../../types/contracts/test/MockPkVerifier";
import type { MockCircuitVerifier } from "../../types/contracts/test/MockSlashingVerifier.sol/MockCircuitVerifier";
import type { MockUSDC } from "../../types/contracts/test/MockStableToken.sol/MockUSDC";
import type { LoxleyTicketToken } from "../../types/contracts/token/LoxleyTicketToken";
import type { LoxleyToken } from "../../types/contracts/token/LoxleyToken";
import { ethers, ignition, networkHelpers } from "./connection";
import {
  ACTIVE_CRYPTO_CONFIG_ID,
  ADDRESS_ONE,
  BFV_PARAMS_DEFAULT,
  COMMITTEE_SIZE_MINIMUM,
  COMMITTEE_THRESHOLDS_DEFAULT,
  DEFAULT_TIMEOUT_CONFIG,
  ENCRYPTION_SCHEME_ID,
  MIN_TICKET_BALANCE,
  REQUIRED_CIPHERNODE_BOND,
  SEVEN_DAYS,
  SORTITION_SUBMISSION_WINDOW,
  THIRTY_DAYS,
  TICKET_PRICE,
} from "./constants";
import { setupOperatorForSortition } from "./operators";

const { time, mine } = networkHelpers;
const abiCoder = ethers.AbiCoder.defaultAbiCoder();

/** Timeout configuration accepted by `Loxley`. */
export interface TimeoutConfig {
  dkgWindow: number;
  computeWindow: number;
  decryptionWindow: number;
}

/**
 * `[CommitteeSize enum value, [M, N]]` passed to `Loxley.setCommitteeThresholds`.
 * On-chain: `threshold[0]` = required honest roster H and `threshold[1]` =
 * committee size N. Pricing resolves the circuit threshold T separately.
 */
export type CommitteeThreshold = [number, [number, number]];

/** Options accepted by {@link deployLoxleySystem}. All optional. */
export interface DeployLoxleySystemOptions {
  /** Override the sortition submission window (seconds). */
  submissionWindow?: number;
  /** Override `Loxley.maxDuration` (seconds). */
  maxDuration?: number;
  /** Override the timeout config. Defaults to {@link DEFAULT_TIMEOUT_CONFIG}. */
  timeoutConfig?: TimeoutConfig;
  /**
   * Install the permissive DKG fold-attestation verifier used by ordinary tests.
   * Defaults to `true`. Set to `false` for verifier lifecycle tests that need an
   * initially unset registry.
   */
  wireMockDkgFoldAttestationVerifier?: boolean;
  /** Treasury for `E3RefundManager`. Defaults to `"owner"`. */
  treasury?: "owner" | Signer;
  /** `slashedFundsTreasury` passed to `BondingRegistry`. Defaults to `"owner"`. */
  slashedFundsTreasury?: "owner" | Signer;
  /**
   * If `true` (default), perform the full slashing-side wiring:
   *  - `loxley.setSlashingManager`
   *  - `registry.setSlashingManager`
   *  - `slashingManager.{setCiphernodeRegistry,setLoxley,setE3RefundManager}`
   *
   * Pass `false` for isolated fixtures that only wire the
   * `bondingRegistry <-> slashingManager` link (always wired).
   */
  wireSlashingManager?: boolean;
  /**
   * `setCommitteeThresholds` pairs to install before operators are onboarded.
   * Defaults to the canonical `[H, N]` configurations.
   */
  committeeThresholds?: CommitteeThreshold[];
  /**
   * Signers to mint `mintUsdcAmount` USDC to.
   * Defaults to `[owner, notTheOwner]`.
   * Pass `[]` to skip end-user USDC minting (operators are still funded).
   */
  mintUsdcTo?: Signer[];
  /** Amount minted to each entry of `mintUsdcTo`. Defaults to 1,000,000 USDC. */
  mintUsdcAmount?: bigint;
  /**
   * Number of operators to bond + register + fund + add to the ciphernode
   * registry. Operators are taken from `getSigners()[2..2+N]`. Defaults to `3`.
   * Pass `0` to skip operator onboarding entirely.
   */
  setupOperators?: number;
  /** Program registered atomically by `Loxley.initialize`. */
  initialE3Program?: string;
  /**
   * If `true`, also deploys the `MockCircuitVerifier` used by slashing
   * proof-based lanes. Defaults to `false`.
   */
  deployCircuitVerifier?: boolean;
  /**
   * If `true`, deploy `MockCiphernodeRegistry` instead of the real
   * `CiphernodeRegistryOwnable`. The mock implements `ICiphernodeRegistry`
   * with no-ops / configurable committees for tests that only exercise
   * BondingRegistry / SlashingManager flows. Implies `setupOperators` may
   * still be used (the mock's `addCiphernode` is a no-op).
   *
   * When `true`, the fixture also skips `ciphernodeRegistry.setSlashingManager`
   * (the mock does not expose that setter).
   */
  useMockCiphernodeRegistry?: boolean;
  /**
   * If `true`, deploy `MockBlacklistUSDC` instead of `MockUSDC` as the
   * fee/ticket token. The returned `usdcToken` is typed as `MockUSDC` but
   * the underlying contract exposes `blacklist`/`unblacklist`; tests can
   * cast to call them.
   */
  useBlacklistFeeToken?: boolean;
}

/** Mock contract bundle returned by {@link deployLoxleySystem}. */
export interface LoxleySystemMocks {
  e3Program: MockE3ProgramHarness;
  decryptionVerifier: MockDecryptionVerifier;
  ciphertextVerifier: MockCiphertextVerifier;
  pkVerifier: MockPkVerifier;
  mockComputeProvider: MockComputeProvider;
  /** Only populated when `deployCircuitVerifier: true`. */
  circuitVerifier?: MockCircuitVerifier;
}

/** Bundle returned by {@link deployLoxleySystem}. */
export interface LoxleySystem {
  // Core
  loxley: Loxley;
  loxleyLifecycle: string;
  loxleyPricing: string;
  ciphernodeRegistry: CiphernodeRegistryOwnable;
  /** Populated only when `useMockCiphernodeRegistry: true`. */
  mockCiphernodeRegistry?: MockCiphernodeRegistry;
  bondingRegistry: BondingRegistry;
  slashingManager: SlashingManager;
  e3RefundManager: E3RefundManager;
  // Tokens
  ciphernodeBondToken: LoxleyToken;
  ticketToken: LoxleyTicketToken;
  usdcToken: MockUSDC;
  // Mocks
  mocks: LoxleySystemMocks;
  // Signers
  owner: Signer;
  notTheOwner: Signer;
  operators: Signer[];
  /** First 3 onboarded operators (when `setupOperators >= 3`). */
  operator1: Signer | undefined;
  operator2: Signer | undefined;
  operator3: Signer | undefined;
  /** Resolved treasury signer for `E3RefundManager`. */
  treasury: Signer;
  /** Resolved slashedFundsTreasury signer for `BondingRegistry`. */
  slashedFundsTreasury: Signer;
  /** Default `Loxley.request(...)` params anchored at the fixture's `time.latest()`. */
  request: ILoxley.E3RequestParamsStruct;
}

/**
 * Deploy a fully-wired Loxley system and return typed handles. Call from a
 * spec's `setup()` and add only file-specific extras (extra signers,
 * custom `committeeThresholds`, custom wiring, etc.).
 *
 * Committee thresholds: installs `committeeThresholds` (default
 * {@link COMMITTEE_THRESHOLDS_DEFAULT}) via `setCommitteeThresholds` before
 * operator onboarding. The default `[T, N]` pair aligns pricing formula tests;
 * production deploy (`scripts/deployLoxley.ts`) uses `[H, N]` instead — same
 * storage slot, different first component for Minimum (T=1 vs H=2).
 */
export async function deployLoxleySystem(
  opts: DeployLoxleySystemOptions = {},
): Promise<LoxleySystem> {
  const submissionWindow = opts.submissionWindow ?? SORTITION_SUBMISSION_WINDOW;
  const maxDuration = opts.maxDuration ?? THIRTY_DAYS;
  const timeoutConfig = opts.timeoutConfig ?? DEFAULT_TIMEOUT_CONFIG;
  const wireSlashingManager = opts.wireSlashingManager ?? true;
  const setupOperators = opts.setupOperators ?? 3;
  const committeeThresholds: CommitteeThreshold[] =
    opts.committeeThresholds ??
    (COMMITTEE_THRESHOLDS_DEFAULT.map(
      ([size, [min, max]]) => [size, [min, max]] as CommitteeThreshold,
    ) as CommitteeThreshold[]);

  // ── Signers ────────────────────────────────────────────────────────────────
  const signers = await ethers.getSigners();
  const [owner, notTheOwner] = signers;
  const ownerAddress = await owner.getAddress();
  if (setupOperators > signers.length - 2) {
    throw new Error(
      `setupOperators (${setupOperators}) exceeds available signers (${signers.length - 2})`,
    );
  }
  const operators: Signer[] = [];
  for (let i = 0; i < setupOperators; i++) {
    operators.push(signers[2 + i]);
  }
  const treasury: Signer =
    opts.treasury && opts.treasury !== "owner" ? opts.treasury : owner;
  const treasuryAddress = await treasury.getAddress();
  const slashedFundsTreasury: Signer =
    opts.slashedFundsTreasury && opts.slashedFundsTreasury !== "owner"
      ? opts.slashedFundsTreasury
      : owner;
  const slashedFundsTreasuryAddress = await slashedFundsTreasury.getAddress();

  // ── Tokens ────────────────────────────────────────────────────────────────
  let usdcToken: MockUSDC;
  if (opts.useBlacklistFeeToken) {
    const blacklistToken = await new MockBlacklistUSDCFactory(owner).deploy();
    await blacklistToken.waitForDeployment();
    // ABI-compatible with MockUSDC for the operations the fixture/spec needs.
    usdcToken = blacklistToken as unknown as MockUSDC;
  } else {
    const { mockUSDC } = await ignition.deploy(MockStableTokenModule, {
      parameters: { MockUSDC: { initialSupply: 10_000_000 } },
    });
    usdcToken = MockUSDCFactory.connect(await mockUSDC.getAddress(), owner);
  }

  // Deferred: LoxleyToken is deployed after BondingRegistry so the
  // immutable BONDING_REGISTRY reference can be set. See below.

  const { loxleyTicketToken } = await ignition.deploy(LoxleyTicketTokenModule, {
    parameters: {
      LoxleyTicketToken: {
        baseToken: await usdcToken.getAddress(),
        registry: ADDRESS_ONE,
        owner: ownerAddress,
      },
    },
  });
  const ticketToken = LoxleyTicketTokenFactory.connect(
    await loxleyTicketToken.getAddress(),
    owner,
  );

  // ── Registry & Slashing ───────────────────────────────────────────────────
  const { slashingManager: _slashingManager } = await ignition.deploy(
    SlashingManagerModule,
    { parameters: { SlashingManager: { admin: ownerAddress } } },
  );
  const slashingManager = SlashingManagerFactory.connect(
    await _slashingManager.getAddress(),
    owner,
  );

  const { cipherNodeRegistry } = await ignition.deploy(
    CiphernodeRegistryModule,
    {
      parameters: {
        CiphernodeRegistry: {
          owner: ownerAddress,
          submissionWindow,
        },
      },
    },
  );
  const ciphernodeRegistryAddress = await cipherNodeRegistry.getAddress();
  const ciphernodeRegistry = CiphernodeRegistryOwnableFactory.connect(
    ciphernodeRegistryAddress,
    owner,
  );

  // Optional mock registry. When supplied, all wiring still uses the
  // mock's address (selectors are compatible). Tests can interact with
  // mock-specific helpers via `mockCiphernodeRegistry`.
  let mockCiphernodeRegistry: MockCiphernodeRegistry | undefined;
  let effectiveRegistryAddress = ciphernodeRegistryAddress;
  if (opts.useMockCiphernodeRegistry) {
    const { mockCiphernodeRegistry: _mockReg } = await ignition.deploy(
      MockCiphernodeRegistryModule,
    );
    const mockRegAddress = await _mockReg.getAddress();
    mockCiphernodeRegistry = MockCiphernodeRegistryFactory.connect(
      mockRegAddress,
      owner,
    );
    effectiveRegistryAddress = mockRegAddress;
  }

  // ── BondingRegistry (deployed before token; uses ADDRESS_ONE placeholder) ──
  const { bondingRegistry: _bondingRegistry } = await ignition.deploy(
    BondingRegistryModule,
    {
      parameters: {
        BondingRegistry: {
          owner: ownerAddress,
          ticketToken: await ticketToken.getAddress(),
          ciphernodeBondToken: ethers.ZeroAddress, // one-time placeholder — fixed below
          registry: effectiveRegistryAddress,
          slashedFundsTreasury: slashedFundsTreasuryAddress,
          ticketPrice: TICKET_PRICE,
          requiredCiphernodeBond: REQUIRED_CIPHERNODE_BOND,
          expectedTicketDecimals: 6,
          expectedCiphernodeBondDecimals: 0,
          minTicketBalance: MIN_TICKET_BALANCE,
          exitDelay: SEVEN_DAYS,
        },
      },
    },
  );
  const bondingRegistry = BondingRegistryFactory.connect(
    await _bondingRegistry.getAddress(),
    owner,
  );
  const bondingRegistryAddress = await bondingRegistry.getAddress();
  await ticketToken.setRegistry(bondingRegistryAddress);

  // ── LoxleyToken (deployed after BondingRegistry for immutable ref) ──
  const deployTime = BigInt(await time.latest());
  const ccaStart = deployTime + 1000n; // keep Virtual phase during setup
  const ccaEnd = ccaStart + 7n * 24n * 60n * 60n; // 7-day CCA window
  const claimSource = ownerAddress; // owner as placeholder claim source
  const lockSunsetDelay = 4n * 365n * 24n * 60n * 60n + 30n * 24n * 60n * 60n;
  const noMoreLocks = ccaEnd + 45n * 24n * 60n * 60n + lockSunsetDelay;
  const { loxleyToken } = await ignition.deploy(LoxleyTokenModule, {
    parameters: {
      LoxleyToken: {
        owner: ownerAddress,
        ccaStart,
        ccaEnd,
        bondingRegistry: bondingRegistryAddress,
        noMoreLocks,
      },
    },
  });
  const ciphernodeBondToken = LoxleyTokenFactory.connect(
    await loxleyToken.getAddress(),
    owner,
  );
  await (await ciphernodeBondToken.setClaimSource(claimSource)).wait();

  // Fix the BondingRegistry ciphernodeBondToken placeholder.
  await bondingRegistry.setBondingAssetConfig({
    ticketToken: await ticketToken.getAddress(),
    ciphernodeBondToken: await ciphernodeBondToken.getAddress(),
    ticketPrice: TICKET_PRICE,
    requiredCiphernodeBond: REQUIRED_CIPHERNODE_BOND,
    expectedTicketDecimals: 6,
    expectedCiphernodeBondDecimals: 18,
  });

  // Deploy the default program before Loxley so initialization can validate it.
  const { mockE3Program: _mockE3Program } =
    await ignition.deploy(MockE3ProgramModule);
  const e3Program = MockE3ProgramFactory.connect(
    await _mockE3Program.getAddress(),
    owner,
  );
  const initialE3Program =
    opts.initialE3Program ?? (await e3Program.getAddress());

  // ── Loxley ────────────────────────────────────────────────────────────────
  const {
    loxley: _loxley,
    loxleyLifecycle: _loxleyLifecycle,
    loxleyPricing: _loxleyPricing,
  } = await ignition.deploy(LoxleyModule, {
    parameters: {
      Loxley: {
        owner: ownerAddress,
        maxDuration,
        registry: effectiveRegistryAddress,
        bondingRegistry: await bondingRegistry.getAddress(),
        e3RefundManager: ADDRESS_ONE, // placeholder — overridden below
        feeToken: await usdcToken.getAddress(),
        feeTokenDecimals: 6,
        timeoutConfig,
        initialE3Program,
      },
    },
  });
  const loxleyAddress = await _loxley.getAddress();
  const loxley = LoxleyFactory.connect(loxleyAddress, owner);
  const loxleyLifecycle = await _loxleyLifecycle.getAddress();
  const loxleyPricing = await _loxleyPricing.getAddress();
  await e3Program.setLoxley(loxleyAddress);

  const { e3RefundManager: _e3RefundManager } = await ignition.deploy(
    E3RefundManagerModule,
    {
      parameters: {
        E3RefundManager: {
          owner: ownerAddress,
          loxley: loxleyAddress,
          treasury: treasuryAddress,
        },
      },
    },
  );
  const e3RefundManagerAddress = await _e3RefundManager.getAddress();
  const e3RefundManager = E3RefundManagerFactory.connect(
    e3RefundManagerAddress,
    owner,
  );
  await loxley.setE3RefundManager(e3RefundManagerAddress);

  // ── Wire base contracts ───────────────────────────────────────────────────
  const registryAddress = await loxley.ciphernodeRegistry();
  if (registryAddress !== effectiveRegistryAddress) {
    await loxley.setCiphernodeRegistry(effectiveRegistryAddress);
  }
  // `setLoxley` / `setBondingRegistry` are present (matching selectors) on
  // both `CiphernodeRegistryOwnable` and `MockCiphernodeRegistry`.
  const registryForWiring = mockCiphernodeRegistry ?? ciphernodeRegistry;
  await registryForWiring.setLoxley(loxleyAddress);
  await registryForWiring.setBondingRegistry(
    await bondingRegistry.getAddress(),
  );
  await slashingManager.setBondingRegistry(await bondingRegistry.getAddress());
  await bondingRegistry.setSlashingManager(await slashingManager.getAddress());
  await bondingRegistry.setRewardDistributor(loxleyAddress);

  if (wireSlashingManager) {
    await loxley.setSlashingManager(await slashingManager.getAddress());
    await registryForWiring.setSlashingManager(
      await slashingManager.getAddress(),
    );
    await slashingManager.setCiphernodeRegistry(effectiveRegistryAddress);
    await slashingManager.setLoxley(loxleyAddress);
    await slashingManager.setE3RefundManager(e3RefundManagerAddress);
  }

  if (wireSlashingManager) {
    await loxley.setRequestsPaused(false);
  }

  // ── Mocks ─────────────────────────────────────────────────────────────────
  const { mockComputeProvider: _mockComputeProvider } = await ignition.deploy(
    mockComputeProviderModule,
  );
  const mockComputeProvider =
    _mockComputeProvider as unknown as MockComputeProvider;

  const { mockDecryptionVerifier: _mockDecryptionVerifier } =
    await ignition.deploy(MockDecryptionVerifierModule);
  const decryptionVerifier = MockDecryptionVerifierFactory.connect(
    await _mockDecryptionVerifier.getAddress(),
    owner,
  );

  const { mockCiphertextVerifier: _mockCiphertextVerifier } =
    await ignition.deploy(MockCiphertextVerifierModule);
  const ciphertextVerifier = MockCiphertextVerifierFactory.connect(
    await _mockCiphertextVerifier.getAddress(),
    owner,
  );

  const { mockPkVerifier: _mockPkVerifier } =
    await ignition.deploy(MockPkVerifierModule);
  const pkVerifier = MockPkVerifierFactory.connect(
    await _mockPkVerifier.getAddress(),
    owner,
  );

  let circuitVerifier: MockCircuitVerifier | undefined;
  if (opts.deployCircuitVerifier) {
    const { mockCircuitVerifier: _mockCircuitVerifier } = await ignition.deploy(
      MockCircuitVerifierModule,
    );
    circuitVerifier = MockCircuitVerifierFactory.connect(
      await _mockCircuitVerifier.getAddress(),
      owner,
    );
  }

  if (!(await loxley.e3Programs(await e3Program.getAddress()))) {
    await loxley.registerE3Program(await e3Program.getAddress());
  }
  await loxley.setParamSet(0, BFV_PARAMS_DEFAULT);
  await loxley.setDecryptionVerifier(
    ENCRYPTION_SCHEME_ID,
    await decryptionVerifier.getAddress(),
  );
  await loxley.setPkVerifier(
    ENCRYPTION_SCHEME_ID,
    await pkVerifier.getAddress(),
  );
  await loxley.setCiphertextVerifier(
    ENCRYPTION_SCHEME_ID,
    await ciphertextVerifier.getAddress(),
  );
  if (
    !mockCiphernodeRegistry &&
    (opts.wireMockDkgFoldAttestationVerifier ?? true)
  ) {
    const mockDkgFoldAttestationVerifier = await ethers.deployContract(
      "MockDkgFoldAttestationVerifier",
    );
    await mockDkgFoldAttestationVerifier.waitForDeployment();
    await ciphernodeRegistry.setInitialDkgFoldAttestationVerifier(
      await mockDkgFoldAttestationVerifier.getAddress(),
    );
  }

  // ── Committee thresholds ([M, N] per CommitteeSize) ─────────────────────
  for (const [size, [m, n]] of committeeThresholds) {
    await loxley.setCommitteeThresholds(size, [m, n]);
  }

  // ── Operators (token stays in Virtual phase — bonding allowed pre-TGE) ────
  if (operators.length > 0) {
    for (const operator of operators) {
      await setupOperatorForSortition(
        operator,
        owner,
        bondingRegistry,
        ciphernodeBondToken,
        usdcToken,
        ticketToken,
        // The mock registry exposes `addCiphernode` as a no-op so the
        // helper still completes successfully; real specs use the owned
        // registry instance.
        (mockCiphernodeRegistry ?? ciphernodeRegistry) as any,
      );
    }
    await mine(1);
  }

  // ── End-user USDC mints ──────────────────────────────────────────────────
  const mintUsdcAmount = opts.mintUsdcAmount ?? ethers.parseUnits("1000000", 6);
  const mintUsdcTo = opts.mintUsdcTo ?? [owner, notTheOwner];
  for (const recipient of mintUsdcTo) {
    await usdcToken.mint(await recipient.getAddress(), mintUsdcAmount);
  }

  // ── Default request struct ───────────────────────────────────────────────
  const now = await time.latest();
  const inputWindowDuration = 300;
  const request: ILoxley.E3RequestParamsStruct = {
    committeeSize: COMMITTEE_SIZE_MINIMUM,
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
    expectedFeeToken: await usdcToken.getAddress(),
    expectedCryptoConfigId: ACTIVE_CRYPTO_CONFIG_ID,
    maxFee: ethers.MaxUint256,
  };

  return {
    loxley,
    loxleyLifecycle,
    loxleyPricing,
    ciphernodeRegistry,
    mockCiphernodeRegistry,
    bondingRegistry,
    slashingManager,
    e3RefundManager,
    ciphernodeBondToken,
    ticketToken,
    usdcToken,
    mocks: {
      e3Program,
      decryptionVerifier,
      ciphertextVerifier,
      pkVerifier,
      mockComputeProvider,
      circuitVerifier,
    },
    owner,
    notTheOwner,
    operators,
    operator1: operators[0],
    operator2: operators[1],
    operator3: operators[2],
    treasury,
    slashedFundsTreasury,
    request,
  };
}
