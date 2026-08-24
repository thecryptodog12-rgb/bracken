# Deploying Loxley to Robinhood Chain (4663)

Everything below has been run end to end on a local node. What has *not* been
run is the real thing: nothing of ours exists on chain 4663 yet.

Read the two warnings at the bottom before you spend gas. They are the parts
that cannot be undone.

---

## What you need first

| | |
|---|---|
| A funded deployer wallet | on chain 4663, holding native gas |
| `PRIVATE_KEY` | that wallet's key, in **your** shell only |
| An E3 program | see step 3 — this is the one real dependency |

Fee token is already settled: **USDG**, `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`
— 6 decimals, 84k holders, verified directly against the chain.

## Toolchain

Already installed on this machine. From a fresh clone you would need:

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 22
export PATH="$HOME/.bb:$HOME/.nargo/bin:$PATH"   # nargo 1.0.0-beta.26, bb 5.1.0
pnpm install
pnpm build:circuits --preset insecure-512 --committee minimum
```

The circuits are already built. Rebuild only after changing anything under
`circuits/`.

---

## Step 1 — Deploy the bond token

This is the token that goes on Pons and that operators bond. It has to exist
before the protocol stack, because the stack takes its address.

```bash
cd ~/interfold
export PRIVATE_KEY=0x…
export ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com

export BOND_TOKEN_NAME=Loxley
export BOND_TOKEN_SYMBOL=LOXLEY
export BOND_TOKEN_SUPPLY=1200000000        # whole tokens, 18 decimals
export BOND_TOKEN_RECIPIENT=0x…            # optional; defaults to deployer

pnpm --filter @loxley/contracts exec hardhat run \
  scripts/deployBondToken.ts --network robinhood
```

Prints the address and the verify command. **Save that address.**

Fixed supply, no mint, no owner, no pause, no fees. Nothing here can freeze a
balance — deliberately, since this token is collateral.

## Step 2 — Launch on Pons

Create the pool and add liquidity with the address from step 1. Nothing in this
repo touches Pons; do it however you normally would.

You can do this before or after step 3. The protocol only needs the token to
exist, not to be liquid.

## Step 3 — Get an E3 program on chain

The stack refuses to deploy without one, and this is the only dependency that
is not solved.

**Option A — `MockE3Program`.** What The Interfold themselves register on
Ethereum mainnet. It applies no application-specific rules and verifies
nothing. Fastest path to something that stands up; be honest about what it is.

**Option B — `CRISPProgram`.** A real program, in
`examples/CRISP/packages/crisp-contracts/`. Its constructor needs a RISC Zero
verifier and two Honk verifiers on chain, and no RISC Zero verifier exists on
4663. That is a project, not a step.

Either way you end with an address for `E3_PROGRAM_ADDRESS`.

## Step 4 — Deploy the protocol stack

```bash
export PRIVATE_KEY=0x…
export ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com

export BOND_TOKEN_ADDRESS=0x…              # step 1
export FEE_TOKEN_ADDRESS=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168   # USDG
export E3_PROGRAM_ADDRESS=0x…              # step 3

export PROTOCOL_TREASURY=0x…               # optional, defaults to deployer
export SLASHER_ADDRESS=0x…                 # optional, defaults to deployer

export DEPLOY_MOCKS=false
export ENABLE_ZK_VERIFICATION=true

pnpm --filter @loxley/contracts exec hardhat run \
  scripts/run.ts --network robinhood
```

Deploys nineteen contracts: ticket token, slashing manager, ciphernode
registry, bonding registry, bonded checkpoints and votes, the Loxley core, the
refund manager, and the real ZK verifiers. Ends with `Cross-contract wiring
verified` and `Enabling E3 requests`.

Addresses land in `packages/loxley-contracts/deployed_contracts.json` under
`robinhood`.

## Step 5 — Point the dashboard at it

```bash
# packages/loxley-dashboard/.env
VITE_DOCS_URL=https://loxley-docs-solplay.vercel.app
```

Then update `src/lib/chain.ts` to read chain 4663 and the new addresses, and
add 4663 to `src/lib/verifierAudit.ts` so the audit page reads your deployment
alongside upstream's.

---

## Two things that cannot be undone

### The deployer key

`hardhat.config.ts` falls back to the public test mnemonic
(`test test … junk`) when `PRIVATE_KEY` is unset. On a local node that is
convenient. On a real chain it means deploying from a wallet whose key is in
every tutorial on the internet.

This is not hypothetical. On chain 4663, `0x46b142DD1E924FAb83eCc3c08e4D46E82f005e0E`
already holds a contract created by that exact test account — same key, same
nonce, same address on every chain. `scripts/deployLoxley.ts` now refuses to
deploy to a non-local chain from it, but the fallback still exists elsewhere.
Set `PRIVATE_KEY` explicitly, every time.

### Decimals

Two tokens, two widths, and the registry checks:

- **bond token — 18 decimals.** `expectedCiphernodeBondDecimals: 18`
- **fee / ticket token — 6 decimals.** `expectedTicketDecimals: 6`

An 18-decimal fee token fails with a custom error carrying only
`(address, 6, 18)`, which tells you nothing unless you already know. USDG has
6, so it fits.

---

## What this does not give you

The contracts will stand up and an E3 can be requested. That is not the same as
a working network.

**No ciphernode operators.** Threshold cryptography with one participant is
theatre: whoever runs every node can decrypt every input. You need independent
parties running nodes with their own bonded collateral. That is persuasion, not
deployment.

**No compute provider.** Without RISC Zero / Boundless no E3 program actually
executes.

**The ciphertext verifier slot stays empty** with `ENABLE_ZK_VERIFICATION=true`
— the real one is RISC Zero based and needs its own setup. This is exactly why
upstream registers a mock there on mainnet. Your own audit page will say so;
that is the page working correctly, not failing.

Run the audit at `#audit` after deploying and read what it says about your own
contracts. It is built to give an unflattering answer when one is deserved.
