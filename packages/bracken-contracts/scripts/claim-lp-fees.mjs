// SPDX-License-Identifier: LGPL-3.0-only
//
// LP-fees innen uit een positie die in een Uniswap-timelock zit.
//
// De positie-NFT is niet van jou zolang de lock loopt -- een timelock-contract
// houdt hem. Dat contract heeft `approveOperator()`, dat de operator (jij)
// goedkeuring geeft op de positie bij de PositionManager. Daarna kun je de fees
// innen zonder de liquiditeit aan te raken: in Uniswap v4 is fees ophalen een
// DECREASE_LIQUIDITY met liquiditeit nul, gevolgd door een TAKE_PAIR.
//
// Draait standaard als DROOGLOOP: hij simuleert en toont wat je zou krijgen.
// Pas met --send worden er transacties verstuurd.
//
// Gebruik:
//   node scripts/claim-lp-fees.mjs            # simuleren, kost niets
//   node scripts/claim-lp-fees.mjs --send     # echt innen
//
// PRIVATE_KEY moet in de omgeving staan (alleen bij --send).
import {
  JsonRpcProvider,
  Wallet,
  Interface,
  AbiCoder,
  formatEther,
  formatUnits,
} from "ethers";

const RPC =
  process.env.ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
const TIMELOCK =
  process.env.TIMELOCK ?? "0x68bd2e8429e3014acfc4d4c275352be05f2c39bc";
const POSM = "0x58daec3116aae6D93017bAAea7749052E8a04fA7";
const TOKEN_ID = BigInt(process.env.POSITION_ID ?? "919746");
const SEND = process.argv.includes("--send");

// Uniswap v4 periphery actions.
const DECREASE_LIQUIDITY = 0x01;
const TAKE_PAIR = 0x11;

const abi = AbiCoder.defaultAbiCoder();
const posm = new Interface([
  "function ownerOf(uint256) view returns (address)",
  "function positionInfo(uint256) view returns (uint256)",
  "function poolKeys(bytes25) view returns (address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)",
  "function getPositionLiquidity(uint256) view returns (uint128)",
  "function modifyLiquidities(bytes unlockData, uint256 deadline) payable",
]);
const timelock = new Interface([
  "function operator() view returns (address)",
  "function timelockBlockNumber() view returns (uint256)",
  "function approveOperator()",
]);

const p = new JsonRpcProvider(RPC);
const read = async (to, iface, fn, args = []) =>
  iface.decodeFunctionResult(
    fn,
    await p.call({ to, data: iface.encodeFunctionData(fn, args) }),
  );

const operator = (await read(TIMELOCK, timelock, "operator"))[0];
const unlockBlock = (await read(TIMELOCK, timelock, "timelockBlockNumber"))[0];
const owner = (await read(POSM, posm, "ownerOf", [TOKEN_ID]))[0];
const liq = (await read(POSM, posm, "getPositionLiquidity", [TOKEN_ID]))[0];
const info = (await read(POSM, posm, "positionInfo", [TOKEN_ID]))[0];
const poolId = "0x" + (info >> 56n).toString(16).padStart(50, "0");
const key = await read(POSM, posm, "poolKeys", [poolId]);
const [c0, c1, fee] = key;
const block = await p.getBlockNumber();

console.log(`  positie      #${TOKEN_ID}`);
console.log(
  `  eigenaar     ${owner}${owner.toLowerCase() === TIMELOCK.toLowerCase() ? "  (timelock)" : ""}`,
);
console.log(`  operator     ${operator}`);
console.log(`  fee-tier     ${Number(fee) / 10000}%`);
console.log(`  liquiditeit  ${liq}`);
console.log(`  ontgrendelt  blok ${unlockBlock}  (nu ${block})`);
console.log("");

// Fees ophalen = liquiditeit met nul verminderen, dan het paar innemen.
const actions =
  "0x" +
  [DECREASE_LIQUIDITY, TAKE_PAIR]
    .map((a) => a.toString(16).padStart(2, "0"))
    .join("");
const params = [
  abi.encode(
    ["uint256", "uint256", "uint128", "uint128", "bytes"],
    [TOKEN_ID, 0n, 0n, 0n, "0x"],
  ),
  abi.encode(["address", "address", "address"], [c0, c1, operator]),
];
const unlockData = abi.encode(["bytes", "bytes[]"], [actions, params]);
const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
const collectData = posm.encodeFunctionData("modifyLiquidities", [
  unlockData,
  deadline,
]);

// Simuleren vanaf de operator. Dit kost niets en zegt of het pad werkt.
console.log("  simulatie van het innen…");
try {
  await p.call({ from: operator, to: POSM, data: collectData });
  console.log("  -> gaat door");
} catch (e) {
  const msg = (e.shortMessage || e.message || "").slice(0, 160);
  console.log(`  -> geweigerd: ${msg}`);
  console.log("");
  console.log(
    "  Dat is verwacht zolang approveOperator() nog niet gedraaid is:",
  );
  console.log("  de PositionManager ziet jouw adres dan niet als gemachtigd.");
}

if (!SEND) {
  console.log("");
  console.log("  DROOGLOOP — er is niets verstuurd.");
  console.log("  Draai met --send om het echt te doen (twee transacties).");
  process.exit(0);
}

if (!process.env.PRIVATE_KEY) {
  console.error("\n  PRIVATE_KEY ontbreekt. Zet hem met:");
  console.error('    read -rs "PRIVATE_KEY?key: " && export PRIVATE_KEY');
  process.exit(1);
}

const w = new Wallet(process.env.PRIVATE_KEY, p);
if (w.address.toLowerCase() !== operator.toLowerCase()) {
  console.error(
    `\n  Deze sleutel hoort bij ${w.address}, maar de operator is ${operator}.`,
  );
  console.error("  Alleen de operator kan dit doen.");
  process.exit(1);
}

console.log("\n  1/2  approveOperator() op de timelock…");
const t1 = await w.sendTransaction({
  to: TIMELOCK,
  data: timelock.encodeFunctionData("approveOperator"),
});
console.log(`       ${t1.hash}`);
await t1.wait();
console.log("       bevestigd");

console.log("\n  2/2  fees innen…");
const before = await p.getBalance(w.address);
const t2 = await w.sendTransaction({ to: POSM, data: collectData });
console.log(`       ${t2.hash}`);
const r2 = await t2.wait();
const after = await p.getBalance(w.address);
const gas = r2.gasUsed * (r2.gasPrice ?? 0n);

console.log("");
console.log(
  "  ETH-verschil na gas:",
  formatEther(after - before + gas - gas),
  "(ruw)",
);
console.log("  gas betaald        :", formatEther(gas));
console.log("");
console.log("  Controleer je saldi; de tokenkant komt binnen als", c1);
