#!/usr/bin/env bash
# SPDX-License-Identifier: LGPL-3.0-only
#
# Loxley deployen naar Robinhood Chain (4663), in één commando.
#
# De runbook was zes blokken die je stuk voor stuk moest plakken, met een adres
# dat je uit stap 1 moest overtypen naar stap 4. Elk van die stappen was een
# plek om een teken kwijt te raken of een adres te verwisselen. Dit doet
# hetzelfde, maar geeft de adressen zelf door.
#
# Over de sleutel: die wordt met een verborgen prompt gevraagd, staat alleen in
# het geheugen van dit proces, wordt nergens weggeschreven en nergens getoond.
# Zet PRIVATE_KEY niet in je omgeving en niet op de commandoregel -- dan komt
# hij in je shell-history terecht.
#
# Gebruik:  bash ~/interfold/deploy.sh

set -uo pipefail
cd "$(dirname "$0")"

RPC="${ROBINHOOD_RPC_URL:-https://rpc.mainnet.chain.robinhood.com}"
USDG="0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"
MIN_ETH="0.01"

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
bold() { printf '\033[1m%s\033[0m\n' "$*"; }

die() { echo; red "GESTOPT: $*"; exit 1; }

# ── Toolchain ───────────────────────────────────────────────────────────────
bold "Loxley -> Robinhood Chain (4663)"
echo

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
  nvm use 22 > /dev/null 2>&1 || true
fi
export PATH="$HOME/.bb:$HOME/.nargo/bin:$PATH"
export ROBINHOOD_RPC_URL="$RPC"

command -v pnpm > /dev/null || die "pnpm niet gevonden."
node --version | grep -q "^v2[2-9]" || die "node 22+ nodig, nu $(node --version)."

CHAIN=$(curl -s --max-time 20 -X POST "$RPC" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
  | python3 -c "import sys,json;print(int(json.load(sys.stdin)['result'],16))" 2>/dev/null)
[ "$CHAIN" = "4663" ] || die "RPC antwoordt met chainId '$CHAIN', verwacht 4663."
grn "  toolchain ok, keten 4663 bereikbaar"

# ── Sleutel ─────────────────────────────────────────────────────────────────
echo
bold "Private key"
echo "Wordt niet getoond, niet opgeslagen, en verlaat dit proces niet."
printf "  key: "
read -rs PRIVATE_KEY
echo
[ -n "$PRIVATE_KEY" ] || die "Geen key ingevoerd."
case "$PRIVATE_KEY" in
  0x*) ;;
  *) PRIVATE_KEY="0x$PRIVATE_KEY" ;;
esac
export PRIVATE_KEY

INFO=$(node -e '
const {Wallet, JsonRpcProvider} = require("./packages/loxley-contracts/node_modules/ethers");
(async () => {
  try {
    const p = new JsonRpcProvider(process.env.ROBINHOOD_RPC_URL);
    const w = new Wallet(process.env.PRIVATE_KEY, p);
    const b = await p.getBalance(w.address);
    console.log(w.address + " " + b.toString());
  } catch (e) { console.log("BAD " + e.shortMessage || e.message); }
})()' 2>/dev/null)

case "$INFO" in
  BAD*) die "Key onbruikbaar: ${INFO#BAD }" ;;
esac
ADDR=${INFO%% *}
WEI=${INFO##* }
[ -n "$ADDR" ] || die "Kon geen adres afleiden uit de key."

ETH=$(python3 -c "print(f'{$WEI/1e18:.6f}')")
echo "  adres : $ADDR"
echo "  saldo : $ETH ETH"

ENOUGH=$(python3 -c "print(1 if $WEI/1e18 >= $MIN_ETH else 0)")
[ "$ENOUGH" = "1" ] || die "Te weinig saldo. Stuur minstens $MIN_ETH ETH naar $ADDR op chain 4663 en draai dit opnieuw."
grn "  saldo volstaat"

# ── Bevestiging ─────────────────────────────────────────────────────────────
echo
bold "Wat er nu gebeurt"
cat <<TXT
  1. LoxleyBondToken   -- 1.200.000.000 LOXLEY, volledige voorraad naar
                          $ADDR
  2. MockE3Program     -- dwingt GEEN applicatieregels af
  3. de stack          -- negentien contracten, echte ZK-verifiers

  Dit is onomkeerbaar en kost echt gas. Geschat 0,0015 ETH.
TXT
echo
printf "Typ 'deploy' om door te gaan: "
read -r CONFIRM
[ "$CONFIRM" = "deploy" ] || die "Afgebroken."

# ── Hervatten ───────────────────────────────────────────────────────────────
# De stack schrijft elk adres weg zodra het gedeployed is en hergebruikt wat er
# staat, dus opnieuw draaien hervat in plaats van dubbel te betalen. Het bond
# token en het E3-programma staan daar echter NIET in -- die worden los
# gedeployed -- dus zonder deze twee variabelen zou een tweede poging een
# tweede token maken met opnieuw de volledige voorraad.
if [ -n "${BOND_TOKEN_ADDRESS:-}" ] && [ -n "${E3_PROGRAM_ADDRESS:-}" ]; then
  BOND="$BOND_TOKEN_ADDRESS"
  PROG="$E3_PROGRAM_ADDRESS"
  echo
  bold "Hervatten met bestaande adressen"
  echo "  LOXLEY        : $BOND"
  echo "  MockE3Program : $PROG"
  SKIP_TOKENS=1
else
  SKIP_TOKENS=0
fi

# ── Stap 1 ──────────────────────────────────────────────────────────────────
if [ "$SKIP_TOKENS" = "0" ]; then
echo
bold "[1/3] Bond token"
BOND_LOG=$(BOND_TOKEN_NAME="${BOND_TOKEN_NAME:-Loxley}" \
           BOND_TOKEN_SYMBOL="${BOND_TOKEN_SYMBOL:-LOXLEY}" \
           BOND_TOKEN_SUPPLY="${BOND_TOKEN_SUPPLY:-1200000000}" \
  pnpm --filter @loxley/contracts exec hardhat run \
    scripts/deployBondToken.ts --network robinhood 2>&1)
BOND=$(echo "$BOND_LOG" | grep -oE "LoxleyBondToken: 0x[0-9a-fA-F]{40}" | cut -d' ' -f2)
if [ -z "$BOND" ]; then
  echo "$BOND_LOG" | tail -20
  die "Bond token niet gedeployed. Er is nog geen gas uitgegeven aan de stack."
fi
grn "  LOXLEY: $BOND"

# ── Stap 2 ──────────────────────────────────────────────────────────────────
echo
bold "[2/3] E3-programma"
PROG_LOG=$(pnpm --filter @loxley/contracts exec hardhat run \
  scripts/deployE3Program.ts --network robinhood 2>&1)
PROG=$(echo "$PROG_LOG" | grep -oE "MockE3Program: 0x[0-9a-fA-F]{40}" | cut -d' ' -f2)
if [ -z "$PROG" ]; then
  echo "$PROG_LOG" | tail -20
  die "E3-programma niet gedeployed. Bond token staat er wel: $BOND"
fi
grn "  MockE3Program: $PROG"
fi

# ── Stap 3 ──────────────────────────────────────────────────────────────────
echo
bold "[3/3] De stack (negentien contracten, duurt even)"
STACK_LOG=$(BOND_TOKEN_ADDRESS="$BOND" \
            E3_PROGRAM_ADDRESS="$PROG" \
            FEE_TOKEN_ADDRESS="$USDG" \
            DEPLOY_MOCKS=false \
            ENABLE_ZK_VERIFICATION=true \
  pnpm --filter @loxley/contracts exec hardhat run \
    scripts/run.ts --network robinhood 2>&1)
echo "$STACK_LOG" | grep -E "deployed to:|wiring verified|Enabling"

if ! echo "$STACK_LOG" | grep -q "wiring verified"; then
  echo
  echo "$STACK_LOG" | tail -25
  die "De stack is niet afgerond. Bond token: $BOND -- E3: $PROG
Loop packages/loxley-contracts/deployed_contracts.json na voordat je opnieuw
draait: de scripts hergebruiken wat daar staat, dus een adres van een mislukte
poging geeft fouten ver van de oorzaak."
fi

CORE=$(echo "$STACK_LOG" | grep -oE "^Loxley deployed to: 0x[0-9a-fA-F]{40}" | grep -oE "0x[0-9a-fA-F]{40}" | head -1)

echo
grn "============================================"
grn " Gedeployed op Robinhood Chain (4663)"
grn "============================================"
echo "  LOXLEY token : $BOND"
echo "  Loxley core  : ${CORE:-zie deployed_contracts.json}"
echo "  E3 programma : $PROG"
echo "  fee token    : $USDG (USDG)"
echo
echo "  Alle adressen: packages/loxley-contracts/deployed_contracts.json"
echo "  Explorer     : https://robinhoodchain.blockscout.com/address/$BOND"
echo
bold "Stuur het 'Loxley core'-adres door om het dashboard erop te richten."
