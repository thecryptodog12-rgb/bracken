// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
import { ethers as ethersLib } from "ethers";
import hre from "hardhat";

import { autoCleanForLocalhost } from "./cleanIgnitionState";
import { configureLocalSlashingPolicies } from "./configureLocalSlashingPolicies";
import { deployAndSaveBfvDecryptionVerifier } from "./deployAndSave/bfvDecryptionVerifier";
import { deployAndSaveBfvPkVerifier } from "./deployAndSave/bfvPkVerifier";
import { deployAndSaveBondedCheckpoints } from "./deployAndSave/bondedCheckpoints";
import { deployAndSaveBondedVotes } from "./deployAndSave/bondedVotes";
import { deployAndSaveBondingRegistry } from "./deployAndSave/bondingRegistry";
import { deployAndSaveCiphernodeRegistryOwnable } from "./deployAndSave/ciphernodeRegistryOwnable";
import { deployAndSaveDkgFoldAttestationVerifier } from "./deployAndSave/dkgFoldAttestationVerifier";
import { deployAndSaveE3RefundManager } from "./deployAndSave/e3RefundManager";
import { deployAndSaveFaucet } from "./deployAndSave/faucet";
import { deployAndSaveLoxley } from "./deployAndSave/loxley";
import { deployAndSaveLoxleyTicketToken } from "./deployAndSave/loxleyTicketToken";
import { deployAndSaveLoxleyToken } from "./deployAndSave/loxleyToken";
import { deployAndSaveMockStableToken } from "./deployAndSave/mockStableToken";
import { deployAndSavePoseidonT3 } from "./deployAndSave/poseidonT3";
import { deployAndSaveSlashingManager } from "./deployAndSave/slashingManager";
import { deployAndSaveAllVerifiers } from "./deployAndSave/verifiers";
import { deployMocks } from "./deployMocks";
import {
  ACTIVE_BFV_COMMITTEE_N,
  ACTIVE_BFV_COMMITTEE_SIZE,
  ACTIVE_BFV_PARAM_SET,
  BFV_DKG_H,
  isLocalDeploymentChain,
  send,
} from "./utils";

// BFV parameter presets — hardcoded from crates/fhe-params/src/constants.rs
// to avoid a cyclic dependency on @loxley/sdk.
const BFV_PARAMS = {
  insecure512: {
    degree: 512n,
    plaintextModulus: 100n,
    moduli: [0xffffee001n, 0xffffc4001n],
    error1Variance: "3",
  },
  secure8192: {
    degree: 8192n,
    plaintextModulus: 131072n,
    moduli: [0x0400000001460001n, 0x0400000000ea0001n, 0x0400000000920001n],
    error1Variance: "2331171231419734472395201298275918858425592709120",
  },
} as const;

function encodeBfvParams(params: {
  degree: bigint;
  plaintextModulus: bigint;
  moduli: readonly bigint[];
  error1Variance: string;
}): string {
  const abiCoder = ethersLib.AbiCoder.defaultAbiCoder();
  return abiCoder.encode(
    [
      "tuple(uint256 degree, uint256 plaintext_modulus, uint256[] moduli, string error1_variance)",
    ],
    [
      [
        params.degree,
        params.plaintextModulus,
        [...params.moduli],
        params.error1Variance,
      ],
    ],
  );
}

/**
 * Default timeout configuration (in seconds)
 */
const DEFAULT_TIMEOUT_CONFIG = {
  dkgWindow: 7200,
  computeWindow: 86400,
  decryptionWindow: 3600,
};

function parseRequiredUint64(value: string, label: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be a base-10 unix timestamp`);
  }
  const parsed = BigInt(value);
  const maxUint64 = (1n << 64n) - 1n;
  if (parsed > maxUint64) {
    throw new Error(`${label} must fit in uint64`);
  }
  return parsed;
}

/** Circuit names required for BFV ZK verification in this script */
const DKG_AGGREGATOR_VERIFIER = "DkgAggregatorVerifier";
const DECRYPTION_AGGREGATOR_VERIFIER = "DecryptionAggregatorVerifier";

/**
 * Deploys the Loxley contracts
 */
export const deployLoxley = async (
  withMocks?: boolean,
  withZKVerification?: boolean,
) => {
  const { ethers } = await hre.network.connect();

  // Auto-clean state for local networks to prevent stale state issues
  const networkName = hre.globalOptions.network ?? "localhost";
  await autoCleanForLocalhost(networkName);

  const [owner] = await ethers.getSigners();

  const ownerAddress = await owner.getAddress();
  const latestBlock = await ethers.provider.getBlock("latest");
  if (!latestBlock) {
    throw new Error("Could not read latest block for local TGE timestamp");
  }

  const encodedInsecure = encodeBfvParams(BFV_PARAMS.insecure512);
  const encodedSecure = encodeBfvParams(BFV_PARAMS.secure8192);

  const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;
  const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7;
  const TGE_COOLDOWN_SECONDS = 60 * 60 * 24 * 40;
  const FOUR_YEARS_IN_SECONDS = 60 * 60 * 24 * 365 * 4;
  const ONE_MONTH_IN_SECONDS = THIRTY_DAYS_IN_SECONDS;
  const LOCK_SUNSET_DELAY_SECONDS =
    FOUR_YEARS_IN_SECONDS + ONE_MONTH_IN_SECONDS;
  // The next block hash is usable by contracts from the following block.
  const SORTITION_SUBMISSION_WINDOW = 60;
  const addressOne = "0x0000000000000000000000000000000000000001";

  const poseidonT3 = await deployAndSavePoseidonT3({ hre });

  const shouldDeployMocks = process.env.DEPLOY_MOCKS === "true" || withMocks;
  const shouldHaveZKVerification =
    process.env.ENABLE_ZK_VERIFICATION === "true" || withZKVerification;

  // H-23: refuse to deploy test mocks (MockUSDC / MockE3ProgramHarness) and the
  // `insecure512` BFV preset on any chain that is not a recognised local /
  // test network. Override via `ALLOW_MOCKS_ON_PRODUCTION=true` only for
  // explicit dry-runs.
  if (shouldDeployMocks) {
    // ── Sleutel-slot ────────────────────────────────────────────────────────
  // hardhat.config valt terug op de publieke test-mnemonic
  // ("test test ... junk") wanneer PRIVATE_KEY niet gezet is. Op een lokale
  // node is dat handig; op een echte keten deploy je dan vanaf een wallet
  // waarvan iedereen de sleutel heeft.
  //
  // Dat is geen theoretisch risico: op Robinhood Chain (4663) staat op
  // 0x46b142DD1E924FAb83eCc3c08e4D46E82f005e0E al een contract dat door
  // precies dat testaccount is aangemaakt. Dezelfde sleutel en dezelfde nonce
  // geven op elke keten hetzelfde adres, dus zulke botsingen zijn de regel,
  // niet de uitzondering.
  {
    const LOCAL_IDS = new Set([31337n, 1337n]);
    const net = await ethers.provider.getNetwork();
    const signers = await ethers.getSigners();
    const deployer = (await signers[0]?.getAddress())?.toLowerCase();
    const WELL_KNOWN = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
    if (!LOCAL_IDS.has(net.chainId) && deployer === WELL_KNOWN) {
      throw new Error(
        `Refusing to deploy to chainId ${net.chainId} from the public hardhat ` +
          `test account (${WELL_KNOWN}). Its private key is in every tutorial ` +
          "on the internet. Set PRIVATE_KEY to a key you control.",
      );
    }
  }

  const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    const LOCAL_CHAIN_IDS = new Set<number>([
      31337, // hardhat
      1337, // ganache / local
      11155111, // sepolia (testnet)
      5, // goerli (testnet)
      80001, // polygon mumbai (testnet)
    ]);
    if (
      !LOCAL_CHAIN_IDS.has(chainId) &&
      process.env.ALLOW_MOCKS_ON_PRODUCTION !== "true"
    ) {
      throw new Error(
        `Refusing to deploy mocks / insecure512 BFV preset on chainId ${chainId}. ` +
          `Set ALLOW_MOCKS_ON_PRODUCTION=true to override (H-23).`,
      );
    }
  }

  let feeTokenAddress: string;
  let mockStableToken:
    | Awaited<
        ReturnType<typeof deployAndSaveMockStableToken>
      >["mockStableToken"]
    | undefined;

  if (shouldDeployMocks) {
    console.log("Deploying mock Fee token...");
    ({ mockStableToken } = await deployAndSaveMockStableToken({
      initialSupply: 1000000,
      hre,
    }));
    feeTokenAddress = await mockStableToken.getAddress();
    console.log("MockFeeToken deployed to:", feeTokenAddress);
  } else {
    // Upstream liet hier alleen een throw staan: er was geen enkele manier om
    // zonder mocks te deployen, ook niet met een bestaand token. Voor een echte
    // keten is dat precies de tak die je nodig hebt.
    const configured = process.env.FEE_TOKEN_ADDRESS;
    if (!configured || !/^0x[0-9a-fA-F]{40}$/.test(configured)) {
      throw new Error(
        "Fee token address must be provided for production deployment. " +
          "Set FEE_TOKEN_ADDRESS to an existing ERC-20 on the target chain.",
      );
    }
    const code = await ethers.provider.getCode(configured);
    if (code === "0x") {
      throw new Error(
        `FEE_TOKEN_ADDRESS ${configured} has no contract code on this chain. ` +
          "Refusing to deploy against a fee token that does not exist.",
      );
    }
    feeTokenAddress = configured;
    console.log("Using existing fee token:", feeTokenAddress);
  }

  // ── CCA window ──────────────────────────────────────────────────────────
  // Alleen van belang als we LoxleyToken zelf deployen. Die draagt de veiling:
  // CCA_START en CCA_END staan immutable in het contract en blokkeren transfers
  // tot na afloop. Wie een eigen bond-token meegeeft (BOND_TOKEN_ADDRESS) raakt
  // die machinerie nooit aan, en ccaStart wordt hieronder dan ook nergens
  // gelezen.
  //
  // Deze eis vuurde eerder onvoorwaardelijk. Dat maakte de gedocumenteerde
  // route -- eigen token deployen, adres meegeven -- onmogelijk: stap 4 brak af
  // op een veiling die niet plaatsvindt, nadat stap 1 en 3 al gas hadden gekost.
  const deployingOwnToken = !process.env.BOND_TOKEN_ADDRESS?.trim();
  const ccaStartEnv = process.env.LOXLEY_CCA_START;
  let ccaStart: bigint;
  if (ccaStartEnv?.trim()) {
    ccaStart = parseRequiredUint64(ccaStartEnv.trim(), "LOXLEY_CCA_START");
  } else if (
    !deployingOwnToken ||
    isLocalDeploymentChain(networkName) ||
    networkName === "sepolia"
  ) {
    const now = BigInt(latestBlock.timestamp);
    ccaStart = now + 3600n; // 1 hour from now
    if (deployingOwnToken) {
      console.warn(
        `[WARN] LOXLEY_CCA_START not set; using ${ccaStart} (block.timestamp + 1h) for ${networkName} deployment.`,
      );
    }
  } else {
    throw new Error(
      "LOXLEY_CCA_START must be set when deploying LoxleyToken (the auction token) " +
        "to a non-local chain. Set BOND_TOKEN_ADDRESS instead to use your own ERC-20 " +
        "and skip the auction entirely.",
    );
  }
  const ccaEnd = ccaStart + BigInt(SEVEN_DAYS_IN_SECONDS);

  console.log("Deploying LoxleyTicketToken...");
  const { loxleyTicketToken } = await deployAndSaveLoxleyTicketToken({
    baseToken: feeTokenAddress,
    registry: addressOne,
    owner: ownerAddress,
    hre,
  });
  const loxleyTicketTokenAddress = await loxleyTicketToken.getAddress();
  console.log("LoxleyTicketToken deployed to:", loxleyTicketTokenAddress);

  console.log("Deploying SlashingManager...");
  const { slashingManager } = await deployAndSaveSlashingManager({
    admin: ownerAddress,
    hre,
  });
  const slashingManagerAddress = await slashingManager.getAddress();
  console.log("SlashingManager deployed to:", slashingManagerAddress);

  console.log("Deploying CiphernodeRegistry...");
  const { ciphernodeRegistry } = await deployAndSaveCiphernodeRegistryOwnable({
    poseidonT3Address: poseidonT3,
    owner: ownerAddress,
    submissionWindow: SORTITION_SUBMISSION_WINDOW,
    hre,
  });
  const ciphernodeRegistryAddress = await ciphernodeRegistry.getAddress();
  console.log("CiphernodeRegistry deployed to:", ciphernodeRegistryAddress);

  // BondingRegistry is deployed before LOXLEY so its address can be passed to
  // the token constructor.  The ciphernode bond token is set to address(0) temporarily
  // and fixed after LOXLEY is deployed with the complete asset configuration.
  console.log("Deploying BondingRegistry...");
  const { bondingRegistry } = await deployAndSaveBondingRegistry({
    owner: ownerAddress,
    ticketToken: loxleyTicketTokenAddress,
    ciphernodeBondToken: ethers.ZeroAddress,
    registry: ciphernodeRegistryAddress,
    slashedFundsTreasury: ownerAddress,
    ticketPrice: ethers.parseUnits("10", 6).toString(),
    requiredCiphernodeBond: ethers.parseEther("100").toString(),
    ticketTokenDecimals: 6,
    ciphernodeBondTokenDecimals: 0,
    minTicketBalance: 1,
    exitDelay: 7 * 24 * 60 * 60,
    hre,
  });
  const bondingRegistryAddress = await bondingRegistry.getAddress();
  console.log("BondingRegistry deployed to:", bondingRegistryAddress);

  // Zelfde reden: setRegistry revert met SameRegistry() als het adres al klopt.
  const currentTicketRegistry = await loxleyTicketToken.registry();
  if (currentTicketRegistry.toLowerCase() === bondingRegistryAddress.toLowerCase()) {
    console.log("LoxleyTicketToken already points at BondingRegistry");
  } else {
    console.log("Setting BondingRegistry address in LoxleyTicketToken...");
    await (await loxleyTicketToken.setRegistry(bondingRegistryAddress)).wait();
  }

  // LOXLEY is deployed with BondingRegistry's real address. Local deployments set
  // the deployer as the one-time claim source placeholder; production sale
  // deployments set the actual auction after it exists.
  console.log("Deploying LOXLEY token...");
  // Een bestaande bond-token meegeven in plaats van LoxleyToken deployen.
  //
  // LoxleyToken bestaat om een CCA-veiling te draaien: CCA_START en CCA_END
  // staan immutable in het contract, tge() kan pas 40 dagen na CCA_END, en tot
  // die tijd zijn transfers geblokkeerd. Wie zijn token op een DEX lanceert
  // heeft aan die machinerie niets -- die zit alleen in de weg.
  //
  // De BondingRegistry stelt geen enkele eis behalve IERC20: hij doet
  // transferFrom en balanceOf, meer niet. Een gewone ERC-20 voldoet dus.
  const externalBondToken = process.env.BOND_TOKEN_ADDRESS;
  if (externalBondToken) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(externalBondToken)) {
      throw new Error("BOND_TOKEN_ADDRESS is not a valid address");
    }
    const bondCode = await ethers.provider.getCode(externalBondToken);
    if (bondCode === "0x") {
      throw new Error(
        `BOND_TOKEN_ADDRESS ${externalBondToken} has no contract code on this chain.`,
      );
    }
    console.log("Using existing bond token:", externalBondToken);
  }

  const { loxleyToken } = externalBondToken
    ? { loxleyToken: null }
    : await deployAndSaveLoxleyToken({
    owner: ownerAddress,
    ccaStart,
    ccaEnd,
    claimSource: ownerAddress,
    bondingRegistry: bondingRegistryAddress,
    noMoreLocks:
      ccaEnd + BigInt(TGE_COOLDOWN_SECONDS + LOCK_SUNSET_DELAY_SECONDS),
    hre,
  });
  const loxleyTokenAddress = externalBondToken ?? (await loxleyToken!.getAddress());
  if (!externalBondToken) {
    console.log("LoxleyToken deployed to:", loxleyTokenAddress);
  }

  // Fix up BondingRegistry's ciphernode bond token now that LOXLEY exists.
  console.log("Setting ciphernode bond token in BondingRegistry...");
  await (
    await bondingRegistry.setBondingAssetConfig({
      ticketToken: loxleyTicketTokenAddress,
      ciphernodeBondToken: loxleyTokenAddress,
      ticketPrice: ethers.parseUnits("10", 6),
      requiredCiphernodeBond: ethers.parseEther("100"),
      expectedTicketDecimals: 6,
      expectedCiphernodeBondDecimals: 18,
    })
  ).wait();

  if (loxleyTokenAddress.toLowerCase() === feeTokenAddress.toLowerCase()) {
    throw new Error(
      "MockUSDC and LoxleyToken resolved to the same address. " +
        "Start a fresh Anvil on http://127.0.0.1:8545 (e.g. `anvil --chain-id 31337`) " +
        "and rerun deploy so token nonces advance separately.",
    );
  }

  // Whitelist BondingRegistry so bonded transfers work pre-TGE.
  // setTransferWhitelisted bestaat alleen op LoxleyToken. Een externe ERC-20
  // kent die functie niet -- en heeft hem ook niet nodig, want daar zijn
  // transfers sowieso vrij.
  if (!externalBondToken) {
    console.log("Whitelisting BondingRegistry in LOXLEY...");
    await (
      await loxleyToken!.setTransferWhitelisted(bondingRegistryAddress, true)
    ).wait();
  }

  // ── Bonded voting ───────────────────────────────────────────────────────
  // Bonded LOXLEY is transferred to BondingRegistry and never delegated, so without a recorded
  // history an operator's bonded weight is invisible to governance while still counting in the
  // quorum denominator. Attached after the license token is set: rotating it detaches the history.
  console.log("Deploying BondedCheckpoints...");
  const { bondedCheckpoints } = await deployAndSaveBondedCheckpoints({
    registry: bondingRegistryAddress,
    hre,
  });
  const bondedCheckpointsAddress = await bondedCheckpoints.getAddress();
  console.log("BondedCheckpoints deployed to:", bondedCheckpointsAddress);

  console.log("Deploying BondedVotes...");
  const { bondedVotes } = await deployAndSaveBondedVotes({
    token: loxleyTokenAddress,
    checkpoints: bondedCheckpointsAddress,
    hre,
  });
  const bondedVotesAddress = await bondedVotes.getAddress();
  console.log("BondedVotes deployed to:", bondedVotesAddress);

  // Eenmalig: setBondedCheckpoints eist dat het slot nog leeg is, want
  // herwijzen zou de opgebouwde geschiedenis achterlaten en elke stem die er
  // doorheen leest stilzwijgend van antwoord laten veranderen. Terecht -- maar
  // het betekent ook dat een hervatte deploy hierop stukloopt met
  // InvalidConfiguration(), terwijl er niets mis is: het staat er al goed.
  //
  // Lezen voor schrijven, hetzelfde patroon dat dit script al gebruikt voor
  // setInitialDkgFoldAttestationVerifier.
  const currentCheckpoints = await bondingRegistry.bondedCheckpoints();
  if (currentCheckpoints.toLowerCase() === bondedCheckpointsAddress.toLowerCase()) {
    console.log("BondedCheckpoints already attached to BondingRegistry");
  } else {
    console.log("Attaching BondedCheckpoints to BondingRegistry...");
    await (
      await bondingRegistry.setBondedCheckpoints(bondedCheckpointsAddress)
    ).wait();
  }

  // ── Testnet faucet (sepolia only) ───────────────────────────────────────
  // Deploy a public Faucet pre-funded with LOXLEY + mock USDC so testers can
  // self-serve tokens. LOXLEY is in the Virtual phase here (CCA_START is ~1h
  // out), so we mint unlocked LOXLEY and whitelist the faucet to bypass the
  // pre-TGE transfer gate. Only on sepolia, and only with mocks present.
  if (networkName === "sepolia" && mockStableToken) {
    // Stock the faucet for this many self-serve claims. Supply is derived from
    // the contract's per-claim amounts so it stays correct if those change.
    const FAUCET_TARGET_MINTS = 1000n;

    console.log("Deploying Faucet...");
    const { faucet } = await deployAndSaveFaucet({
      fold: loxleyTokenAddress,
      feeToken: feeTokenAddress,
      hre,
    });
    const faucetAddress = await faucet.getAddress();
    console.log("Faucet deployed to:", faucetAddress);

    const amountFold = await faucet.AMOUNT_FOLD();
    const amountFeeToken = await faucet.AMOUNT_FEE_TOKEN();
    const FAUCET_FOLD_SUPPLY = amountFold * FAUCET_TARGET_MINTS;
    const FAUCET_USDC_SUPPLY = amountFeeToken * FAUCET_TARGET_MINTS;

    // Whitelist the faucet so faucet -> tester LOXLEY transfers pass the
    // pre-TGE gate (transferWhitelist[from] short-circuits the restriction).
    console.log("Whitelisting Faucet in LOXLEY...");
    await (
      await loxleyToken!.setTransferWhitelisted(faucetAddress, true)
    ).wait();

    console.log("Minting LOXLEY to Faucet...");
    await (
      await loxleyToken!.mint(
        faucetAddress,
        FAUCET_FOLD_SUPPLY,
        ethers.encodeBytes32String("faucet"),
      )
    ).wait();

    console.log("Minting mock USDC to Faucet...");
    await (
      await mockStableToken.mint(faucetAddress, FAUCET_USDC_SUPPLY)
    ).wait();

    console.log(
      `Faucet funded with ${ethers.formatEther(FAUCET_FOLD_SUPPLY)} LOXLEY ` +
        `and ${ethers.formatUnits(FAUCET_USDC_SUPPLY, 6)} USDC.`,
    );
  }

  const mockDeployments = shouldDeployMocks ? await deployMocks() : undefined;

  // Zonder mocks was er geen enkele manier om een bestaand E3-programma mee te
  // geven; het script gooide er simpelweg uit. Dat is ook precies waarom
  // upstream's mainnet een MockE3Program als eerste programma registreert.
  let initialE3Program: string;
  if (mockDeployments) {
    initialE3Program = mockDeployments.e3ProgramAddress;
  } else {
    const configured = process.env.E3_PROGRAM_ADDRESS;
    if (!configured || !/^0x[0-9a-fA-F]{40}$/.test(configured)) {
      throw new Error(
        "An initial E3 Program is required. Set E3_PROGRAM_ADDRESS to a " +
          "deployed IE3Program on the target chain, or set DEPLOY_MOCKS=true " +
          "to register a mock instead (which verifies nothing).",
      );
    }
    const programCode = await ethers.provider.getCode(configured);
    if (programCode === "0x") {
      throw new Error(
        `E3_PROGRAM_ADDRESS ${configured} has no contract code on this chain.`,
      );
    }
    initialE3Program = configured;
    console.log("Using existing E3 program:", initialE3Program);
  }

  console.log("Deploying Loxley...");
  const { loxley } = await deployAndSaveLoxley({
    owner: ownerAddress,
    maxDuration: THIRTY_DAYS_IN_SECONDS.toString(),
    registry: ciphernodeRegistryAddress,
    bondingRegistry: bondingRegistryAddress,
    e3RefundManager: addressOne, // placeholder, will be updated
    feeToken: feeTokenAddress,
    timeoutConfig: DEFAULT_TIMEOUT_CONFIG,
    initialE3Program,
    hre,
  });
  const loxleyAddress = await loxley.getAddress();
  console.log("Loxley deployed to:", loxleyAddress);

  console.log("Deploying E3RefundManager...");
  const { e3RefundManager } = await deployAndSaveE3RefundManager({
    owner: ownerAddress,
    loxley: loxleyAddress,
    treasury: ownerAddress, // Protocol treasury
    hre,
  });
  const e3RefundManagerAddress = await e3RefundManager.getAddress();
  console.log("E3RefundManager deployed to:", e3RefundManagerAddress);

  console.log("Setting E3RefundManager in Loxley...");
  await send(
    loxley.setE3RefundManager(e3RefundManagerAddress),
    "loxley.setE3RefundManager",
  );

  ///////////////////////////////////////////
  // Configure cross-contract dependencies
  ///////////////////////////////////////////

  console.log("Configuring cross-contract dependencies...");

  console.log("Setting Loxley address in CiphernodeRegistry...");
  await send(
    ciphernodeRegistry.setLoxley(loxleyAddress),
    "ciphernodeRegistry.setLoxley",
  );

  console.log("Setting BondingRegistry address in CiphernodeRegistry...");
  await send(
    ciphernodeRegistry.setBondingRegistry(bondingRegistryAddress),
    "ciphernodeRegistry.setBondingRegistry",
  );

  console.log("Setting Submission Window in CiphernodeRegistry...");
  console.log("SORTITION_SUBMISSION_WINDOW:", SORTITION_SUBMISSION_WINDOW);
  await send(
    ciphernodeRegistry.setSortitionSubmissionWindow(
      SORTITION_SUBMISSION_WINDOW,
    ),
    "ciphernodeRegistry.setSortitionSubmissionWindow",
  );

  console.log("Setting CiphernodeRegistry address in BondingRegistry...");
  await send(
    bondingRegistry.setRegistry(ciphernodeRegistryAddress),
    "bondingRegistry.setRegistry",
  );

  console.log("Setting Loxley address in SlashingManager...");
  await send(
    slashingManager.setLoxley(loxleyAddress),
    "slashingManager.setLoxley",
  );

  console.log("Setting BondingRegistry address in SlashingManager...");
  await send(
    slashingManager.setBondingRegistry(bondingRegistryAddress),
    "slashingManager.setBondingRegistry",
  );

  console.log("Setting CiphernodeRegistry address in SlashingManager...");
  await send(
    slashingManager.setCiphernodeRegistry(ciphernodeRegistryAddress),
    "slashingManager.setCiphernodeRegistry",
  );

  console.log("Setting E3RefundManager address in SlashingManager...");
  await send(
    slashingManager.setE3RefundManager(e3RefundManagerAddress),
    "slashingManager.setE3RefundManager",
  );

  console.log("Setting SlashingManager address in Loxley...");
  await send(
    loxley.setSlashingManager(slashingManagerAddress),
    "loxley.setSlashingManager",
  );

  console.log("Setting SlashingManager address in BondingRegistry...");
  await send(
    bondingRegistry.setSlashingManager(slashingManagerAddress),
    "bondingRegistry.setSlashingManager",
  );

  console.log("Setting SlashingManager address in CiphernodeRegistry...");
  await send(
    ciphernodeRegistry.setSlashingManager(slashingManagerAddress),
    "ciphernodeRegistry.setSlashingManager",
  );

  if (shouldDeployMocks) {
    console.log("Configuring local SlashingManager slash policies...");
    await configureLocalSlashingPolicies(hre, slashingManager);
  }

  // H-24: SLASHER_ROLE must be granted explicitly. Without this, Lane B
  // (evidence-based) slash proposals are uncallable and there is no on-chain
  // path to penalise nodes for off-chain misbehaviour. Source the slasher
  // address from $SLASHER_ADDRESS, falling back to the deployer with a
  // visible warning so testnet deployments stay functional but production
  // operators are forced to set it intentionally.
  const slasherAddress = process.env.SLASHER_ADDRESS || ownerAddress;
  if (!process.env.SLASHER_ADDRESS) {
    console.warn(
      "[WARN] SLASHER_ADDRESS not set \u2014 granting SLASHER_ROLE to deployer.\n" +
        "       Set SLASHER_ADDRESS to the production slasher EOA / multisig\n" +
        "       and revoke from the deployer before going live.",
    );
  }
  console.log(`Granting SLASHER_ROLE to ${slasherAddress}...`);
  const addSlasherTx = await slashingManager.addSlasher(slasherAddress);
  await addSlasherTx.wait();
  const slasherRole = await slashingManager.SLASHER_ROLE();
  const slasherGranted = await slashingManager.hasRole(
    slasherRole,
    slasherAddress,
  );
  if (!slasherGranted) {
    throw new Error(
      `Failed to grant SLASHER_ROLE to ${slasherAddress} \u2014 aborting deployment`,
    );
  }
  console.log("SLASHER_ROLE granted.");

  console.log("Setting Loxley as reward distributor in BondingRegistry...");
  await send(
    bondingRegistry.setRewardDistributor(loxleyAddress),
    "bondingRegistry.setRewardDistributor",
  );

  // E3RefundManager already has correct loxley from deployment

  console.log("Setting the active committee configuration...");
  await send(
    loxley.setCommitteeThresholds(ACTIVE_BFV_COMMITTEE_SIZE, [
      BFV_DKG_H,
      ACTIVE_BFV_COMMITTEE_N,
    ]),
    "loxley.setCommitteeThresholds",
  );
  console.log(
    `Active committee configuration set to [${BFV_DKG_H},${ACTIVE_BFV_COMMITTEE_N}]`,
  );

  // Register BFV param sets
  console.log("Registering BFV param sets...");
  const activeParams =
    ACTIVE_BFV_PARAM_SET === 0 ? encodedInsecure : encodedSecure;
  // Eenmalig: setParamSet revert met ParamSetAlreadyRegistered zodra het slot
  // gevuld is, ook met identieke parameters. paramSetRegistry is public, dus
  // de vraag "staat het er al" is gewoon te stellen.
  const existingParams = await loxley.paramSetRegistry(ACTIVE_BFV_PARAM_SET);
  if (existingParams && existingParams !== "0x") {
    console.log(
      `BFV parameter set ${ACTIVE_BFV_PARAM_SET} already registered`,
    );
  } else {
    await send(
      loxley.setParamSet(ACTIVE_BFV_PARAM_SET, activeParams),
      "loxley.setParamSet",
    );
    console.log(`Active BFV parameter set ${ACTIVE_BFV_PARAM_SET} registered`);
  }

  const encryptionSchemeId = ethers.keccak256(ethers.toUtf8Bytes("fhe.rs:BFV"));

  // Set pricing config with protocol treasury
  const protocolTreasury = process.env.PROTOCOL_TREASURY || ownerAddress;
  console.log("Setting pricing config...");
  await send(
    loxley.setFeeAssetConfig({
      token: feeTokenAddress,
      expectedDecimals: 6,
      pricing: {
        keyGenFixedPerNode: 100000, // 0.10 USDC
        keyGenPerEncryptionProof: 50000, // 0.05 USDC
        coordinationPerPair: 10000, // 0.01 USDC
        availabilityPerNodePerSec: 50, // 0.00005 USDC
        decryptionPerNode: 300000, // 0.30 USDC
        publicationBase: 1000000, // 1.00 USDC
        verificationPerProof: 5000, // 0.005 USDC
        protocolTreasury: protocolTreasury,
        marginBps: 1000, // 10%
        protocolShareBps: 182, // 1.82% gross ~= 20% of 10% margin
        dkgUtilizationBps: 2500, // 25%
        computeUtilizationBps: 5000, // 50%
        decryptUtilizationBps: 2500, // 25%
        minCommitteeSize: 0,
        minThreshold: 0,
      },
    }),
    "loxley.setFeeAssetConfig",
  );
  console.log("Pricing config set (treasury:", protocolTreasury, ")");

  if (mockDeployments) {
    const {
      decryptionVerifierAddress: mockDecryptionVerifierAddress,
      ciphertextVerifierAddress: mockCiphertextVerifierAddress,
      pkVerifierAddress: mockPkVerifierAddress,
      e3ProgramAddress,
    } = mockDeployments;

    console.log("encryptionSchemeId", encryptionSchemeId);

    if (!shouldHaveZKVerification && mockDecryptionVerifierAddress) {
      const deployedDecryptionVerifier =
        await loxley.decryptionVerifiers(encryptionSchemeId);
      if (deployedDecryptionVerifier === mockDecryptionVerifierAddress) {
        console.log(`DecryptionVerifier already set in Loxley contract`);
      } else {
        const tx = await loxley.setDecryptionVerifier(
          encryptionSchemeId,
          mockDecryptionVerifierAddress,
        );
        await tx.wait();
        console.log(
          `Successfully set MockDecryptionVerifier in Loxley contract`,
        );
      }
    }

    if (!shouldHaveZKVerification && mockPkVerifierAddress) {
      const deployedPkVerifier = await loxley.pkVerifiers(encryptionSchemeId);
      if (deployedPkVerifier === mockPkVerifierAddress) {
        console.log(`PkVerifier already set in Loxley contract`);
      } else {
        const tx = await loxley.setPkVerifier(
          encryptionSchemeId,
          mockPkVerifierAddress,
        );
        await tx.wait();
        console.log(`Successfully set MockPkVerifier in Loxley contract`);
      }
    }

    if (!shouldHaveZKVerification && mockCiphertextVerifierAddress) {
      const deployedCiphertextVerifier =
        await loxley.getCiphertextVerifier(encryptionSchemeId);
      if (deployedCiphertextVerifier === mockCiphertextVerifierAddress) {
        console.log("CiphertextVerifier already set in Loxley contract");
      } else {
        const tx = await loxley.setCiphertextVerifier(
          encryptionSchemeId,
          mockCiphertextVerifierAddress,
        );
        await tx.wait();
        console.log(
          "Successfully set MockCiphertextVerifier in Loxley contract",
        );
      }
    }

    if (await loxley.e3Programs(e3ProgramAddress)) {
      console.log(`E3 Program already enabled in Loxley contract`);
    } else {
      const tx = await loxley.registerE3Program(e3ProgramAddress);
      await tx.wait();
      console.log(`Successfully enabled E3 Program in Loxley contract`);
    }
  }

  let verifierDeployments: Record<string, string> = {};
  if (shouldHaveZKVerification) {
    console.log("Deploying circuit verifiers...");
    verifierDeployments = await deployAndSaveAllVerifiers(hre);
    const requiredVerifierNames = [
      DKG_AGGREGATOR_VERIFIER,
      DECRYPTION_AGGREGATOR_VERIFIER,
    ] as const;
    for (const name of requiredVerifierNames) {
      const addr = verifierDeployments[name];
      if (!addr?.trim()) {
        throw new Error(
          `ZK verification enabled but "${name}" is missing from verifier deployments ` +
            `(got ${verifierDeployments[name] === undefined ? "undefined" : JSON.stringify(addr)}). ` +
            `Ensure deployAndSaveAllVerifiers discovers and deploys this circuit, or fix verifier artifacts.`,
        );
      }
    }
  } else {
    console.log("Skipping circuit verifiers (ENABLE_ZK_VERIFICATION not set)");
  }
  const verifierEntries = Object.entries(verifierDeployments);

  if (shouldHaveZKVerification) {
    console.log("Deploying BfvDecryptionVerifier and registering for prod...");
    const { bfvDecryptionVerifier } = await deployAndSaveBfvDecryptionVerifier(
      hre,
      ciphernodeRegistryAddress,
    );
    const bfvDecryptionVerifierAddress =
      await bfvDecryptionVerifier.getAddress();
    const deployedDecryptionVerifier =
      await loxley.decryptionVerifiers(encryptionSchemeId);
    if (deployedDecryptionVerifier !== bfvDecryptionVerifierAddress) {
      const tx = await loxley.setDecryptionVerifier(
        encryptionSchemeId,
        bfvDecryptionVerifierAddress,
      );
      await tx.wait();
      console.log("Successfully set BfvDecryptionVerifier in Loxley contract");
    }
  }

  if (shouldHaveZKVerification) {
    console.log("Deploying BfvPkVerifier and registering for prod...");
    const { bfvPkVerifier } = await deployAndSaveBfvPkVerifier(hre);
    const bfvPkVerifierAddress = await bfvPkVerifier.getAddress();
    const deployedPkVerifier = await loxley.pkVerifiers(encryptionSchemeId);
    if (deployedPkVerifier !== bfvPkVerifierAddress) {
      const tx = await loxley.setPkVerifier(
        encryptionSchemeId,
        bfvPkVerifierAddress,
      );
      await tx.wait();
      console.log("Successfully set BfvPkVerifier in Loxley contract");
    }
  }

  let dkgFoldAttestationVerifierAddress: string | undefined;
  if (shouldHaveZKVerification) {
    console.log("Deploying DkgFoldAttestationVerifier...");
    const { dkgFoldAttestationVerifier } =
      await deployAndSaveDkgFoldAttestationVerifier(hre);
    dkgFoldAttestationVerifierAddress =
      await dkgFoldAttestationVerifier.getAddress();
    const currentVerifier =
      await ciphernodeRegistry.dkgFoldAttestationVerifier();
    if (currentVerifier !== dkgFoldAttestationVerifierAddress) {
      const tx = await ciphernodeRegistry.setInitialDkgFoldAttestationVerifier(
        dkgFoldAttestationVerifierAddress,
      );
      await tx.wait();
      console.log(
        "Successfully set DkgFoldAttestationVerifier on CiphernodeRegistry",
      );
    }
  } else if (shouldDeployMocks) {
    console.log("Deploying MockDkgFoldAttestationVerifier for test/CI...");
    const mockDkgFoldAttestationVerifier = await ethers.deployContract(
      "MockDkgFoldAttestationVerifier",
    );
    await mockDkgFoldAttestationVerifier.waitForDeployment();
    dkgFoldAttestationVerifierAddress =
      await mockDkgFoldAttestationVerifier.getAddress();
    const tx = await ciphernodeRegistry.setInitialDkgFoldAttestationVerifier(
      dkgFoldAttestationVerifierAddress,
    );
    await tx.wait();
    console.log(
      "Successfully set MockDkgFoldAttestationVerifier on CiphernodeRegistry",
    );
  }

  const verifierLines =
    verifierEntries.length > 0
      ? verifierEntries.map(([name, addr]) => `    ${name}: ${addr}`).join("\n")
      : "    (none)";

  const decryptionVerifierAddress =
    await loxley.decryptionVerifiers(encryptionSchemeId);
  const pkVerifierAddress = await loxley.pkVerifiers(encryptionSchemeId);

  ///////////////////////////////////////////
  // Verify the wiring actually landed
  ///////////////////////////////////////////
  //
  // Every setter above is a separate transaction, and a deploy is judged by whether the script
  // exited zero. That is not the same thing: a dropped write leaves a contract pointing at
  // `address(0)`, the script still reports success, and the failure only surfaces much later as an
  // opaque revert from deep inside an unrelated call. Reading the values back costs a handful of
  // eth_calls and turns that into a named failure here.
  console.log("Verifying cross-contract wiring...");
  const wiring: Array<[string, Promise<string>, string]> = [
    [
      "loxley.ciphernodeRegistry",
      loxley.ciphernodeRegistry(),
      ciphernodeRegistryAddress,
    ],
    [
      "loxley.bondingRegistry",
      loxley.bondingRegistry(),
      bondingRegistryAddress,
    ],
    [
      "loxley.e3RefundManager",
      loxley.e3RefundManager(),
      e3RefundManagerAddress,
    ],
    [
      "loxley.slashingManager",
      loxley.slashingManager(),
      slashingManagerAddress,
    ],
    ["ciphernodeRegistry.loxley", ciphernodeRegistry.loxley(), loxleyAddress],
    [
      "ciphernodeRegistry.bondingRegistry",
      ciphernodeRegistry.bondingRegistry(),
      bondingRegistryAddress,
    ],
    [
      "ciphernodeRegistry.slashingManager",
      ciphernodeRegistry.slashingManager(),
      slashingManagerAddress,
    ],
    [
      "bondingRegistry.registry",
      bondingRegistry.registry(),
      ciphernodeRegistryAddress,
    ],
    [
      "bondingRegistry.slashingManager",
      bondingRegistry.slashingManager(),
      slashingManagerAddress,
    ],
    [
      "bondingRegistry.ciphernodeBondToken",
      bondingRegistry.ciphernodeBondToken(),
      loxleyTokenAddress,
    ],
    [
      "ticketToken.registry",
      loxleyTicketToken.registry(),
      bondingRegistryAddress,
    ],
    [
      "bondingRegistry.bondedCheckpoints",
      bondingRegistry.bondedCheckpoints(),
      bondedCheckpointsAddress,
    ],
    [
      "bondedCheckpoints.registry",
      bondedCheckpoints.registry(),
      bondingRegistryAddress,
    ],
    ["bondedVotes.token", bondedVotes.token(), loxleyTokenAddress],
    [
      "bondedVotes.checkpoints",
      bondedVotes.checkpoints(),
      bondedCheckpointsAddress,
    ],
    ["slashingManager.loxley", slashingManager.loxley(), loxleyAddress],
    [
      "slashingManager.bondingRegistry",
      slashingManager.bondingRegistry(),
      bondingRegistryAddress,
    ],
    [
      "slashingManager.ciphernodeRegistry",
      slashingManager.ciphernodeRegistry(),
      ciphernodeRegistryAddress,
    ],
    [
      "slashingManager.e3RefundManager",
      slashingManager.e3RefundManager(),
      e3RefundManagerAddress,
    ],
  ];

  const wiringErrors: string[] = [];
  for (const [label, actualPromise, expected] of wiring) {
    const actual = await actualPromise;
    if (actual.toLowerCase() !== expected.toLowerCase()) {
      wiringErrors.push(`${label}: expected ${expected}, got ${actual}`);
    }
  }

  // The reward distributor is an authorization flag, not an address slot, so it needs its own
  // read-back rather than an entry in the address table above.
  if (!(await bondingRegistry.authorizedDistributors(loxleyAddress))) {
    wiringErrors.push(
      `bondingRegistry.authorizedDistributors: ${loxleyAddress} is not authorized`,
    );
  }
  if (wiringErrors.length > 0) {
    throw new Error(
      `Deployment finished with ${wiringErrors.length} unwired reference(s):\n  ` +
        wiringErrors.join("\n  "),
    );
  }
  console.log("Cross-contract wiring verified.");

  console.log("Enabling E3 requests...");
  await send(
    loxley.setRequestsPaused(false),
    "loxley.setRequestsPaused(false)",
  );

  console.log(`
    ============================================
    Deployment Complete!
    ============================================
    MockFeeToken: ${feeTokenAddress}
    LoxleyToken (LOXLEY): ${loxleyTokenAddress}
    LoxleyTicketToken: ${loxleyTicketTokenAddress}
    SlashingManager: ${slashingManagerAddress}
    BondingRegistry: ${bondingRegistryAddress}
    BondedCheckpoints: ${bondedCheckpointsAddress}
    BondedVotes: ${bondedVotesAddress}
    CiphernodeRegistry: ${ciphernodeRegistryAddress}
    E3RefundManager: ${e3RefundManagerAddress}
    Loxley: ${loxleyAddress}
    DecryptionVerifier (BFV): ${decryptionVerifierAddress}
    PkVerifier (BFV): ${pkVerifierAddress}
    Circuit Verifiers:
${verifierLines}
    DkgFoldAttestationVerifier: ${dkgFoldAttestationVerifierAddress ?? "(not deployed)"}
    ============================================
  `);
};
