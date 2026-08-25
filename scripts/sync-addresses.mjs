// SPDX-License-Identifier: LGPL-3.0-only
//
// Alle contractadressen in de docs synchroniseren met deployed_contracts.json.
//
// Dit bestaat omdat het twee keer met de hand is gebeurd en de tweede keer een
// hele stack opnieuw gedeployed werd. Adressen staan in de deployments-pagina,
// in twee operator-tabellen, in twee YAML-configvoorbeelden en in een tutorial.
// Elk daarvan met de hand bijwerken is een uitnodiging om er één te vergeten --
// en een vergeten adres in een operator-config wijst een node naar een contract
// dat niet meer bestaat.
//
// Gebruik:  node scripts/sync-addresses.mjs [--check]
//           --check schrijft niets en meldt alleen wat zou wijzigen.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const STATE = path.join(ROOT, "packages/bracken-contracts/deployed_contracts.json");
const EXPLORER = "https://robinhoodchain.blockscout.com/address";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const CHECK = process.argv.includes("--check");

const state = JSON.parse(fs.readFileSync(STATE, "utf8")).robinhood ?? {};
const at = (name) => {
  const v = state[name];
  return (typeof v === "string" ? v : v?.address) || null;
};

const required = ["Bracken", "CiphernodeRegistryOwnable", "BondingRegistry", "BrackenBondToken"];
const missing = required.filter((n) => !at(n));
if (missing.length) {
  console.error(`Ontbreekt in deployed_contracts.json onder "robinhood": ${missing.join(", ")}`);
  console.error("Deploy eerst de stack; dit script schrijft niets op basis van halve gegevens.");
  process.exit(1);
}

// ── De deployments-pagina ───────────────────────────────────────────────────
const GROUPS = [
  ["Core", [
    ["Bracken", "The protocol. Requests, lifecycle, verifier registry."],
    ["CiphernodeRegistryOwnable", "Committee selection and key publication."],
    ["E3RefundManager", "Fee refunds when an E3 fails."],
  ]],
  ["Tokens", [
    ["BrackenBondToken", "BRACKEN. Operator collateral, 18 decimals."],
    ["BrackenTicketToken", "Ticket collateral wrapper, 6 decimals."],
  ]],
  ["Bonding and slashing", [
    ["BondingRegistry", "Bonds, eligibility, slashing accounting."],
    ["BondedCheckpoints", "Checkpointed bonded balances."],
    ["BondedVotes", "Voting power over bonded stake."],
    ["SlashingManager", "Proposals, appeals, execution."],
  ]],
  ["Proof verifiers", [
    ["BfvDecryptionVerifier", "Threshold decryption proof."],
    ["BfvPkVerifier", "DKG public-key proof."],
    ["DkgFoldAttestationVerifier", "Fold attestation."],
    ["DecryptionAggregatorVerifier", "Honk aggregator, decryption."],
    ["DkgAggregatorVerifier", "Honk aggregator, DKG."],
  ]],
  ["Programs", [
    ["MockE3Program", "The registered E3 program. Enforces no application rules — see the warning above."],
  ]],
  ["Libraries", [
    ["PoseidonT3", "Poseidon hash."],
    ["BrackenPricing", "Fee validation."],
    ["BrackenLifecycle", "Lifecycle validation."],
    ["RegistrySortitionLib", "Sortition scoring."],
    ["BondingAssetLib", "Bonding asset checks."],
    ["BondingEligibilityLib", "Eligibility checks."],
    ["BondingSlashingLib", "Slashing accounting."],
    ["BondingRegistrationLib", "Registration."],
    ["BondingOwnershipLib", "Bond ownership."],
    ["SlashingEvidenceLib", "Evidence handling."],
    ["ZKTranscriptLib", "Honk transcript."],
    ["RelationsLib", "Honk relations."],
  ]],
];

const head = `---
title: 'Deployments'
description: 'Every Bracken contract on Robinhood Chain, with its address and what it does'
---

import { Callout } from 'nextra/components'

# Deployments

Bracken runs on **Robinhood Chain**, chain id \`4663\`. Every address below is live
and readable on [Blockscout](https://robinhoodchain.blockscout.com).

<Callout type='warning'>
  **The registered E3 program enforces no application rules.** \`MockE3Program\`
  accepts whatever reaches it. That is enough to bring a network up and run the
  protocol end to end; it is not enough for anything to depend on the result. A
  real program needs a RISC Zero verifier, which does not exist on this chain
  today.
</Callout>

<Callout type='info'>
  **No ciphernode operators are running yet.** Threshold cryptography with one
  participant is theatre: whoever runs every node can decrypt every input. The
  contracts are deployed and the sortition works, but a committee needs
  independent parties with their own bonded collateral. See
  [Run a ciphernode](/ciphernode-operators).
</Callout>
`;

const parts = [head];
for (const [title, rows] of GROUPS) {
  const lines = rows.filter(([n]) => at(n));
  if (!lines.length) continue;
  parts.push(`\n## ${title}\n`, "| Contract | Address | |", "|---|---|---|");
  for (const [n, note] of lines) parts.push(`| \`${n}\` | [\`${at(n)}\`](${EXPLORER}/${at(n)}) | ${note} |`);
}
parts.push(`
## Fee token

Bracken charges for computation in **USDG**, not in BRACKEN:

| | |
|---|---|
| Address | [\`${USDG}\`](${EXPLORER}/${USDG}) |
| Decimals | 6 |

The width matters: \`BondingRegistry\` stores \`expectedTicketDecimals: 6\` and
rejects a fee token whose \`decimals()\` disagrees. The bond token is 18. See
[Tokenomics](/tokenomics#two-tokens-two-widths).

## Verifying the source

Most contracts have their source published on Blockscout, so you can read what
runs rather than trusting this page. Where a contract still shows as unverified,
the source is in
[the repository](https://github.com/thecryptodog12-rgb/loxley/tree/main/packages/bracken-contracts/contracts)
and can be matched against the deployed bytecode yourself.
`);

const pageBody = parts.join("\n") + "\n";
const pagePath = path.join(ROOT, "docs/pages/deployments.mdx");
const pageChanged = !fs.existsSync(pagePath) || fs.readFileSync(pagePath, "utf8") !== pageBody;

// ── Losse adressen elders ───────────────────────────────────────────────────
// Alles wat als 0x-adres in de docs staat en een contract van ons is, wordt
// vervangen door de huidige waarde. De koppeling gaat op contractnaam, dus een
// hernoemde stack wordt vanzelf meegenomen.
const OLD_TO_NEW = new Map();
const scanFiles = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", "out", ".git", "dist"].includes(e.name)) continue;
      walk(p);
    } else if (/\.(mdx|json|ts|tsx|jsx)$/.test(e.name)) scanFiles.push(p);
  }
};
walk(path.join(ROOT, "docs"));

// Elk 0x-adres in de docs dat NIET in de huidige staat voorkomt en ook niet de
// USDG- of een github-achtige waarde is, is een wees uit een oude deploy.
const current = new Set(Object.keys(state).map((k) => at(k)).filter(Boolean).map((a) => a.toLowerCase()));
current.add(USDG.toLowerCase());

const orphans = new Map();
for (const f of scanFiles) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/0x[0-9a-fA-F]{40}/g)) {
    if (!current.has(m[0].toLowerCase())) {
      orphans.set(m[0], (orphans.get(m[0]) ?? new Set()).add(path.relative(ROOT, f)));
    }
  }
}

// ── Rapport ─────────────────────────────────────────────────────────────────
console.log(`Stack op keten 4663: ${Object.keys(state).length} contracten`);
console.log(`  Bracken          ${at("Bracken")}`);
console.log(`  BRACKEN token    ${at("BrackenBondToken")}`);
console.log(`  BondingRegistry ${at("BondingRegistry")}`);
console.log("");
console.log(`deployments.mdx ${pageChanged ? (CHECK ? "ZOU WIJZIGEN" : "bijgewerkt") : "ongewijzigd"}`);

if (orphans.size) {
  console.log(`\nAdressen in de docs die NIET in de huidige stack zitten (${orphans.size}):`);
  for (const [a, files] of orphans) console.log(`  ${a}  in ${[...files].join(", ")}`);
  console.log("\nDeze wijzen naar contracten die niet meer bij deze deployment horen.");
} else {
  console.log("\nGeen weesadressen in de docs.");
}

console.log("\nVercel-variabelen voor het dashboard:");
console.log(`  VITE_BRACKEN_ADDRESS=${at("Bracken")}`);
console.log(`  VITE_CIPHERNODE_REGISTRY_ADDRESS=${at("CiphernodeRegistryOwnable")}`);
console.log(`  VITE_BONDING_REGISTRY_ADDRESS=${at("BondingRegistry")}`);

if (!CHECK && pageChanged) fs.writeFileSync(pagePath, pageBody);
