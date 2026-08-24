#!/usr/bin/env bash
# SPDX-License-Identifier: LGPL-3.0-only
#
# Droogloop van de volledige deploy tegen een fork van keten 4663.
#
# De echte deploy is drie commando's en negentien contracten, en de duurste
# manier om te ontdekken dat stap 4 faalt is stap 4 bereiken -- dan is het gas
# van stap 1 en 3 al weg en staat er een halve installatie op de keten.
#
# Dit draait exact dezelfde drie commando's tegen een lokale fork van 4663, dus
# tegen de echte ketenstaat inclusief het echte USDG-contract waarvan de
# BondingRegistry `decimals()` leest. Er wordt geen gas uitgegeven en er komt
# niets op de echte keten.
#
# Belangrijk: dit gebruikt een wegwerp-sleutel die hier ter plekke gemaakt en
# na afloop gewist wordt. Je eigen PRIVATE_KEY komt er niet aan te pas en hoort
# hier ook niet gezet te worden.
#
# Gebruik:  ./scripts/dry-run-robinhood.sh

set -euo pipefail
cd "$(dirname "$0")/.."

RPC="${ROBINHOOD_RPC_URL:-https://rpc.mainnet.chain.robinhood.com}"
NODE_RPC="http://127.0.0.1:8545"
USDG="0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"
STATE="packages/loxley-contracts/deployed_contracts.json"
WORK="$(mktemp -d)"

rpc() { curl -s --max-time 20 -X POST "$1" -H 'content-type: application/json' -d "$2"; }

# Adressen van de droogloop uit de gedeelde staat halen.
#
# Dit hoort in een trap en niet als laatste regel van het script. Stond het aan
# het eind, dan sloeg `set -e` het over zodra iets eerder faalde -- en juist dan
# blijven er adressen van een dode fork achter. De volgende droogloop leest die,
# hergebruikt een contract dat op de nieuwe fork niet bestaat, en sneuvelt op
# een raadselachtige `circuitVerifier()` die 0x teruggeeft. Zo is deze regel
# ontstaan.
purge_state() {
  python3 - "$STATE" <<'PYCLEAN'
import json, sys, pathlib
p = pathlib.Path(sys.argv[1])
try:
    d = json.load(open(p))
except Exception:
    raise SystemExit(0)
if any(k in d for k in ("robinhoodLocal", "robinhoodFork")):
    for k in ("robinhoodLocal", "robinhoodFork"):
        d.pop(k, None)
    p.write_text(json.dumps(d, indent=2) + "\n")
PYCLEAN
}

cleanup() {
  purge_state
  rm -rf "$WORK"
  if [ -n "${NODE_PID:-}" ]; then kill "$NODE_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

purge_state   # ook vooraf, voor het geval een eerdere run hard is afgebroken

echo "-- Fork starten van ${RPC}"
pnpm --filter @loxley/contracts exec hardhat node \
  --fork "$RPC" --chain-id 4663 --port 8545 > "$WORK/node.log" 2>&1 &
NODE_PID=$!

for _ in $(seq 1 60); do
  if rpc "$NODE_RPC" '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' | grep -q 0x1237; then
    break
  fi
  sleep 1
done
BLOCK=$(rpc "$NODE_RPC" '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' \
  | python3 -c "import sys,json;print(int(json.load(sys.stdin)['result'],16))")
echo "   fork draait op blok $BLOCK"

echo "-- Wegwerp-deployer aanmaken"
( cd packages/loxley-contracts && node -e "
const {Wallet}=require('ethers');
const w=Wallet.createRandom();
require('fs').writeFileSync(process.argv[1],'export PRIVATE_KEY='+w.privateKey+'\nexport ADDR='+w.address+'\n');
console.log('   ' + w.address);
" "$WORK/key" )
# shellcheck source=/dev/null
. "$WORK/key"
rpc "$NODE_RPC" "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"hardhat_setBalance\",\"params\":[\"$ADDR\",\"0x56BC75E2D63100000\"]}" > /dev/null

echo "-- Stap 1: bond token"
BOND=$(BOND_TOKEN_NAME="${BOND_TOKEN_NAME:-Loxley}" \
       BOND_TOKEN_SYMBOL="${BOND_TOKEN_SYMBOL:-LOXLEY}" \
       BOND_TOKEN_SUPPLY="${BOND_TOKEN_SUPPLY:-1200000000}" \
  pnpm --filter @loxley/contracts exec hardhat run scripts/deployBondToken.ts \
    --network robinhoodLocal 2>&1 | grep -oE "LoxleyBondToken: 0x[0-9a-fA-F]{40}" | cut -d' ' -f2)
[ -n "$BOND" ] || { echo "   GEFAALD"; exit 1; }
echo "   $BOND"

echo "-- Stap 3: E3-programma"
PROG=$(pnpm --filter @loxley/contracts exec hardhat run scripts/deployE3Program.ts \
  --network robinhoodLocal 2>&1 | grep -oE "MockE3Program: 0x[0-9a-fA-F]{40}" | cut -d' ' -f2)
[ -n "$PROG" ] || { echo "   GEFAALD"; exit 1; }
echo "   $PROG"

echo "-- Stap 4: de volledige stack"
BOND_TOKEN_ADDRESS="$BOND" \
FEE_TOKEN_ADDRESS="$USDG" \
E3_PROGRAM_ADDRESS="$PROG" \
DEPLOY_MOCKS=false \
ENABLE_ZK_VERIFICATION=true \
  pnpm --filter @loxley/contracts exec hardhat run scripts/run.ts \
    --network robinhoodLocal 2>&1 | grep -E "deployed to:|wiring verified|Enabling|Error" | tail -25

echo "-- Kosten"
# De gasprijs komt van de ECHTE keten, niet van de simulatie: die hanteert zijn
# eigen basefee van 1 gwei, wat de schatting tientallen keren te hoog maakte.
# Met curl opgehaald, want de publieke RPC weigert urllib met een 403.
REAL_GAS=$(rpc "$RPC" '{"jsonrpc":"2.0","id":1,"method":"eth_gasPrice","params":[]}' \
  | python3 -c "import sys,json;print(int(json.load(sys.stdin)['result'],16))")

python3 - "$ADDR" "$NODE_RPC" "$REAL_GAS" <<'PYCOST'
import json, sys, urllib.request
ADDR, NODE, GAS = sys.argv[1].lower(), sys.argv[2], int(sys.argv[3])
def rpc(m, p):
    req = urllib.request.Request(NODE,
        data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": m, "params": p}).encode(),
        headers={"content-type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=20))["result"]
latest = int(rpc("eth_blockNumber", []), 16)
nonce = int(rpc("eth_getTransactionCount", [ADDR, "latest"]), 16)
total, found, n = 0, 0, latest
while n > 0 and found < nonce:
    b = rpc("eth_getBlockByNumber", [hex(n), True])
    for tx in b["transactions"]:
        if tx["from"].lower() == ADDR:
            total += int(rpc("eth_getTransactionReceipt", [tx["hash"]])["gasUsed"], 16)
            found += 1
    n -= 1
gwei = GAS / 1e9
cost = total * gwei * 1e-9
print(f"   {found} transacties, {total:,} gas")
print(f"   gasprijs op 4663 nu: {gwei:.4f} gwei")
print(f"   geschatte kosten: {cost:.6f} ETH")
print(f"   fund met minstens {max(cost * 10, 0.01):.3f} ETH -- ruim, de prijs kan stijgen")
PYCOST

echo ""
echo "============================================"
echo "Droogloop geslaagd. Er staat niets op de echte keten."
echo "============================================"
