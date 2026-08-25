// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// Demo mode.
//
// Niets van Bracken staat op keten 4663, dus het dashboard leest lege adressen
// en toont lege panelen. Een dashboard dat alleen maar leeg is, laat niet zien
// wat het doet -- en wie het protocol beoordeelt, kijkt juist naar hoe een
// draaiend netwerk eruitziet.
//
// Dus draait dit een gefabriceerd netwerk. De hele voorwaarde daarvoor is dat
// niemand het per ongeluk voor echt aanziet, en dat is geen kwestie van een
// bannertje: DEMO staat aan dankzij de *afwezigheid* van een adres, zit in de
// datavorm zelf (elke E3 draagt `demo: true`), en het label hangt niet aan een
// component die je kunt vergeten mee te renderen.
//
// Zodra VITE_BRACKEN_ADDRESS een echt adres is, valt dit bestand volledig stil.

import type { E3Summary } from './e3'
import { CONTRACTS } from './chain'

const isSet = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a) && !/^0x0{40}$/.test(a)

/** Aan zolang er geen echt kernadres geconfigureerd is. Nooit handmatig te zetten. */
export const DEMO = !isSet(CONTRACTS.Bracken)

// ── Het gefabriceerde netwerk ───────────────────────────────────────────────
// Vaste waarden, geen willekeur: twee bezoekers zien hetzelfde scherm, en een
// screenshot blijft kloppen. Alleen de klok en de logstroom bewegen.

const ADDR = (n: number): `0x${string}` => `0x${n.toString(16).padStart(40, '0')}` as `0x${string}`
const HASH = (n: number): `0x${string}` => `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`

export type DemoNode = {
  label: string
  address: `0x${string}`
  bond: number
  state: 'seated' | 'idle' | 'slashed'
  duties: number
}

/** De comité-pool. Zeven knopen, zoals een klein maar echt netwerk. */
export const DEMO_NODES: DemoNode[] = [
  { label: 'cn-01', address: ADDR(0x01), bond: 25_000, state: 'seated', duties: 148 },
  { label: 'cn-02', address: ADDR(0x02), bond: 25_000, state: 'seated', duties: 142 },
  { label: 'cn-03', address: ADDR(0x03), bond: 40_000, state: 'seated', duties: 151 },
  { label: 'cn-04', address: ADDR(0x04), bond: 25_000, state: 'idle', duties: 139 },
  { label: 'cn-05', address: ADDR(0x05), bond: 60_000, state: 'idle', duties: 155 },
  { label: 'cn-06', address: ADDR(0x06), bond: 25_000, state: 'idle', duties: 121 },
  // Eén geslashte knoop, want een dashboard dat alleen gezonde toestanden toont
  // verbergt precies het geval waar het slashing-mechanisme voor bestaat.
  { label: 'cn-07', address: ADDR(0x07), bond: 18_500, state: 'slashed', duties: 96 },
]

/** E3's over de hele levenscyclus, zodat elke fase één keer te zien is. */
export const DEMO_E3S: (E3Summary & { demo: true })[] = [
  mk(42, 3, 3, 0), // KeyPublished
  mk(41, 4, 3, 128), // CiphertextReady
  mk(40, 5, 3, 512), // Complete
  mk(39, 5, 5, 1024), // Complete
  mk(38, 6, 3, 0), // Failed
  mk(37, 5, 3, 256), // Complete
]

function mk(id: number, stage: number, committee: number, ballots: number): E3Summary & { demo: true } {
  const t = BigInt(1_780_000_000 - (50 - id) * 3600)
  return {
    id: BigInt(id),
    e3Program: ADDR(0xe3),
    requester: ADDR(0x1000 + id),
    requestBlock: t,
    requestTxHash: HASH(0xabc000 + id),
    inputWindow: [t, t + 3600n],
    committeeSize: committee,
    stage,
    ballotCount: ballots,
    demo: true,
  }
}

// ── Logstroom ───────────────────────────────────────────────────────────────
// Wat een draaiend netwerk werkelijk uitzendt, in de volgorde waarin het gebeurt.
// De weergave loopt hier doorheen op een klok, zodat het scherm leeft zonder dat
// er iets willekeurigs of onherhaalbaars in zit.

export type DemoLogLine = { tag: string; text: string; kind: 'info' | 'ok' | 'warn' | 'bad' }

export const DEMO_LOG: DemoLogLine[] = [
  { tag: 'REQUEST', text: 'E3 #0042 requested · window 60m · committee 3', kind: 'info' },
  { tag: 'SORTITION', text: 'tickets scored · 7 eligible · 3 drawn', kind: 'info' },
  { tag: 'COMMITTEE', text: 'cn-01 cn-02 cn-03 seated · threshold 2/3', kind: 'ok' },
  { tag: 'DKG', text: 'round 1 · individual public keys committed', kind: 'info' },
  { tag: 'DKG', text: 'round 2 · shares encrypted to committee', kind: 'info' },
  { tag: 'PROOF', text: 'share_encryption verified · 3/3', kind: 'ok' },
  { tag: 'DKG', text: 'aggregate public key published', kind: 'ok' },
  { tag: 'INPUT', text: '128 ciphertexts accepted · window closing', kind: 'info' },
  { tag: 'PROOF', text: 'greco encryption proof verified · 128/128', kind: 'ok' },
  { tag: 'COMPUTE', text: 'E3 #0041 program executed · receipt pending', kind: 'info' },
  { tag: 'DECRYPT', text: 'threshold decryption · 2/3 shares in', kind: 'info' },
  { tag: 'DECRYPT', text: 'plaintext published on chain', kind: 'ok' },
  { tag: 'SLASH', text: 'cn-07 missed decryption duty · bond reduced', kind: 'bad' },
  { tag: 'APPEAL', text: 'cn-07 appeal window open · 48h', kind: 'warn' },
  { tag: 'REQUEST', text: 'E3 #0043 queued · awaiting sortition', kind: 'info' },
]

/** Verifier-slots zoals ze eruitzien als het netwerk volledig opgetuigd is. */
export const DEMO_SLOTS = [
  { label: 'Ciphertext', verdict: 'present' as const, note: 'GRECO encryption proof' },
  { label: 'Decryption', verdict: 'present' as const, note: 'threshold share proof' },
  { label: 'Public key', verdict: 'present' as const, note: 'DKG aggregation proof' },
]

// Afgeleiden voor de voetstrook, zodat die niet zijn eigen versie van dezelfde
// getallen bijhoudt en de ops-view kan tegenspreken.
export const DEMO_ACTIVE = DEMO_E3S.filter((e) => e.stage > 0 && e.stage < 5).length
export const DEMO_BALLOTS = DEMO_E3S.reduce((s, e) => s + e.ballotCount, 0)
export const DEMO_POLLS = DEMO_E3S.filter((e) => e.ballotCount > 0).length
