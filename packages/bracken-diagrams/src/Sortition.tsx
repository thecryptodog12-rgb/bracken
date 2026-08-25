// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// Sortition, shown as the lottery it actually is.
//
// The docs state the rule in one line -- score = keccak256(node, ticketNumber,
// e3Id, seed), lowest score wins, each node submits its single best ticket --
// and then say "probability scales linearly with your tickets". That sentence
// is true but it does not land. Seeing forty dots scatter across the score
// space and watching your lowest one move left as you buy tickets does.
//
// Deliberately NOT a real keccak: this is an illustration of the distribution,
// not a simulation of the contract. It is labelled as such on screen, because a
// diagram that looks like live data while being made up is worse than no
// diagram at all.

import { useCallback, useEffect, useMemo, useState } from 'react'

type Peer = { name: string; tickets: number; you?: boolean }

const PEERS: Peer[] = [
  { name: 'you', tickets: 4, you: true },
  { name: 'node-b', tickets: 9 },
  { name: 'node-c', tickets: 3 },
  { name: 'node-d', tickets: 14 },
  { name: 'node-e', tickets: 6 },
]

// Committee grootte in dit voorbeeld. De echte waarde komt uit threshold_n
// plus een buffer; hier is het een vast getal om het plaatje leesbaar te
// houden.
const COMMITTEE = 3

// Deterministische pseudo-random uit (seed, node, ticket) -- dezelfde vorm als
// de echte score-afleiding, alleen met een goedkope hash. Deterministisch zodat
// een re-render niet stiekem opnieuw trekt.
function score(seed: number, node: number, ticket: number): number {
  let h = (seed * 0x9e3779b1) ^ (node * 0x85ebca6b) ^ (ticket * 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  h ^= h >>> 15
  return (h >>> 0) / 0xffffffff
}

const W = 920
const H = 210
const AXIS_Y = 132
const PAD = 48
const px = (v: number) => PAD + v * (W - PAD * 2)

export default function Sortition() {
  const [seed, setSeed] = useState(1)
  const [yourTickets, setYourTickets] = useState(4)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])

  const peers = useMemo(() => PEERS.map((p) => (p.you ? { ...p, tickets: yourTickets } : p)), [yourTickets])

  const draws = useMemo(
    () =>
      peers.map((p, pi) => {
        const scores = Array.from({ length: p.tickets }, (_, t) => score(seed, pi, t))
        return { ...p, scores, best: scores.length ? Math.min(...scores) : 1 }
      }),
    [peers, seed],
  )

  // Elke node dient één ticket in: zijn laagste. De committee is de laagste
  // COMMITTEE daarvan.
  const ranked = useMemo(() => [...draws].sort((a, b) => a.best - b.best), [draws])
  const winners = useMemo(() => new Set(ranked.slice(0, COMMITTEE).map((d) => d.name)), [ranked])

  const totalTickets = draws.reduce((s, d) => s + d.tickets, 0)
  const yourShare = totalTickets ? yourTickets / totalTickets : 0
  const youWon = winners.has('you')

  const redraw = useCallback(() => setSeed((s) => s + 1), [])

  return (
    <section className={`lxd sortition ${reduced ? 'is-still' : ''}`} aria-label='How sortition picks a committee'>
      <div className='sortition__head'>
        <span className='lxd-eyebrow'>Getting picked</span>
        <h2 className='sortition__title'>Every ticket is one draw. The lowest number wins.</h2>
        <p className='sortition__lede'>
          When an E3 is requested, a seed is fixed from a committed block hash. Each of your tickets hashes to a score —{' '}
          <code>keccak256(node, ticketNumber, e3Id, seed)</code> — and you submit only your best one. Holding more tickets does not raise
          your score; it gives you more chances at a low one.
        </p>
      </div>

      <svg className='sortition__svg' viewBox={`0 0 ${W} ${H}`} role='img' aria-label={ariaFor(ranked, winners, youWon)}>
        {/* score-as */}
        <line x1={PAD} y1={AXIS_Y} x2={W - PAD} y2={AXIS_Y} className='so-axis' />
        <text x={PAD} y={AXIS_Y + 26} className='so-axis-label'>
          0 — LOWEST SCORE WINS
        </text>
        <text x={W - PAD} y={AXIS_Y + 26} className='so-axis-label so-axis-label--end'>
          2²⁵⁶
        </text>

        {/* afsnijpunt: alles links hiervan zit in de committee */}
        {ranked[COMMITTEE - 1] && (
          <g>
            <line x1={px(ranked[COMMITTEE - 1].best)} y1='22' x2={px(ranked[COMMITTEE - 1].best)} y2={AXIS_Y} className='so-cut' />
            <text x={px(ranked[COMMITTEE - 1].best)} y='16' className='so-cut-label'>
              COMMITTEE CUT
            </text>
          </g>
        )}

        {draws.map((d, di) => {
          const rowY = 44 + di * 17
          return (
            <g key={d.name} className={`so-row ${d.you ? 'so-row--you' : ''} ${winners.has(d.name) ? 'so-row--in' : ''}`}>
              <text x={PAD - 10} y={rowY + 4} className='so-name'>
                {d.name}
              </text>
              {d.scores.map((sc, ti) => (
                <circle key={ti} cx={px(sc)} cy={rowY} r='2.6' className='so-dot' style={{ transitionDelay: `${ti * 12}ms` }} />
              ))}
              {/* het ingediende ticket */}
              <circle cx={px(d.best)} cy={rowY} r='5.5' className='so-best' />
            </g>
          )
        })}
      </svg>

      <div className='sortition__controls'>
        <label className='sortition__slider'>
          <span>
            Your tickets: <strong>{yourTickets}</strong>
          </span>
          <input type='range' min={1} max={30} value={yourTickets} onChange={(e) => setYourTickets(Number(e.target.value))} />
        </label>
        <button className='lxd-btn' onClick={redraw}>
          New seed — draw again
        </button>
      </div>

      <div className='sortition__readout'>
        <div>
          <dt>Your share of all tickets</dt>
          <dd className='sortition__figure'>{(yourShare * 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt>This draw</dt>
          <dd className={`sortition__verdict ${youWon ? 'is-in' : ''}`}>{youWon ? 'You made the committee' : 'You missed it'}</dd>
        </div>
        <div>
          <dt>Committee size shown</dt>
          <dd className='sortition__figure'>{COMMITTEE}</dd>
        </div>
      </div>

      <p className='sortition__foot'>
        Illustration, not live data — the scores here come from a cheap hash, not from keccak against a real seed. Three things it does get
        right, and they matter: balances are snapshotted at <code>requestBlock - 1</code>, so tickets bought after a request do nothing for
        that round; the draw is deterministic, so every honest node computes the same committee; and doubling your tickets doubles your
        share but guarantees nothing. Idle tickets still cost you — rewards accrue only when you are selected and complete your duties.
      </p>
    </section>
  )
}

function ariaFor(ranked: { name: string; best: number }[], winners: Set<string>, youWon: boolean): string {
  const inNames = ranked.filter((r) => winners.has(r.name)).map((r) => r.name)
  return `Score distribution for five operators. This draw selects ${inNames.join(', ')}. You ${youWon ? 'are' : 'are not'} in the committee.`
}
