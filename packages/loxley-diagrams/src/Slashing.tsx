// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// What it costs to get it wrong.
//
// The docs have a mermaid flowchart of the slash lifecycle and three separate
// tables of penalties, actions and exit mechanics. All correct, and all of it
// answers a question nobody asked. The question an operator actually has is:
// what can be taken from me, and how long is my money not mine?
//
// So: one path from violation to penalty with the appeal branch drawn as a
// branch, and next to it the two things that survive it — the exit clock and
// the fields of SlashPolicy that decide the size of the hit.

const W = 900
const H = 176
const LANE = 74
const BRANCH = 140

type Node = { id: string; x: number; y: number; label: string; kind?: 'start' | 'bad' | 'good' | 'fork' }

// Kaders schalen met hun label. Een vaste breedte liet "Penalties applied"
// buiten zijn doos lopen -- het soort detail dat een diagram amateuristisch
// laat lijken ongeacht hoe klopt wat erin staat.
const boxW = (label: string) => Math.max(96, label.length * 7.1 + 26)

const NODES: Node[] = [
  { id: 'v', x: 62, y: LANE, label: 'Violation', kind: 'start' },
  { id: 'p', x: 232, y: LANE, label: 'SlashProposed' },
  { id: 'f', x: 402, y: LANE, label: 'Appeal window', kind: 'fork' },
  { id: 'x', x: 612, y: LANE, label: 'Executed', kind: 'bad' },
  { id: 'c', x: 612, y: BRANCH, label: 'Cancelled', kind: 'good' },
  { id: 'e', x: 790, y: LANE, label: 'Penalties applied', kind: 'bad' },
]

const byId = (id: string) => NODES.find((n) => n.id === id)!

const EDGES: { from: string; to: string; label?: string; tone?: 'bad' | 'good' }[] = [
  { from: 'v', to: 'p' },
  { from: 'p', to: 'f' },
  { from: 'f', to: 'x', label: 'no appeal, or rejected', tone: 'bad' },
  { from: 'f', to: 'c', label: 'appeal accepted', tone: 'good' },
  { from: 'x', to: 'e', tone: 'bad' },
]

const PENALTIES: { field: string; takes: string; note: string }[] = [
  {
    field: 'ticketPenalty',
    takes: 'Burns tLOXLEY',
    note: 'Straight out of your ticket balance. Drop below the minimum and you go inactive.',
  },
  {
    field: 'ciphernodeBondPenalty',
    takes: 'Confiscates LOXLEY',
    note: 'Out of the bond itself — the collateral you posted to register at all.',
  },
  {
    field: 'affectsCommittee',
    takes: 'Expels you mid-E3',
    note: 'You lose the duty you were drawn for, and the reward that came with it.',
  },
  {
    field: 'banNode',
    takes: 'Bans the node',
    note: 'No re-registration until governance clears it. This one is not a fine, it is an exit.',
  },
]

export default function Slashing() {
  return (
    <section className='lxd slashing' aria-label='Slashing and exits'>
      <div className='slashing__head'>
        <span className='lxd-eyebrow'>What it costs to get it wrong</span>
        <h2 className='slashing__title'>
          Your bond is the reason anyone <em>believes</em> you.
        </h2>
        <p className='slashing__lede'>
          Ciphernodes are paid to show up and punished for not showing up. Both halves matter: rewards alone would make missing a duty free,
          and that is exactly the assumption the whole protocol is trying to remove.
        </p>
      </div>

      <svg
        className='slashing__svg'
        viewBox={`0 0 ${W} ${H}`}
        role='img'
        aria-label='A violation becomes a proposal, which is either appealed successfully and cancelled, or executed into penalties.'
      >
        {EDGES.map((e) => {
          const a = byId(e.from)
          const b = byId(e.to)
          const straight = a.y === b.y
          const ha = boxW(a.label) / 2
          const hb = boxW(b.label) / 2
          const d = straight
            ? `M ${a.x + ha + 6} ${a.y} L ${b.x - hb - 6} ${b.y}`
            : `M ${a.x + ha - 10} ${a.y + 14} C ${a.x + ha + 40} ${b.y}, ${b.x - hb - 60} ${b.y}, ${b.x - hb - 6} ${b.y}`
          return (
            <g key={`${e.from}-${e.to}`}>
              <path d={d} className={`sl-edge ${e.tone ? `sl-edge--${e.tone}` : ''}`} />
              {e.label && (
                <text x={(a.x + b.x) / 2} y={straight ? a.y - 16 : b.y - 15} className={`sl-edge-label sl-edge-label--${e.tone}`}>
                  {e.label}
                </text>
              )}
            </g>
          )
        })}

        {NODES.map((n) => (
          <g key={n.id} className={`sl-node ${n.kind ? `sl-node--${n.kind}` : ''}`}>
            <rect x={n.x - boxW(n.label) / 2} y={n.y - 16} width={boxW(n.label)} height='32' rx='16' className='sl-node__box' />
            <text x={n.x} y={n.y + 4} className='sl-node__label'>
              {n.label}
            </text>
          </g>
        ))}
      </svg>

      <div className='slashing__grid'>
        <div className='slashing__penalties'>
          <h3>What a policy can take</h3>
          <dl>
            {PENALTIES.map((p) => (
              <div key={p.field}>
                <dt>
                  <code>{p.field}</code>
                  <span>{p.takes}</span>
                </dt>
                <dd>{p.note}</dd>
              </div>
            ))}
          </dl>
        </div>

        <aside className='slashing__clock'>
          <h3>And you cannot just walk</h3>
          <ol>
            <li>
              <span className='slashing__step'>1</span>
              <div>
                <strong>Deregister</strong>
                <p>Tickets burn immediately; the collateral behind them goes into a queue, and so does the bond.</p>
              </div>
            </li>
            <li>
              <span className='slashing__step'>2</span>
              <div>
                <strong>Wait out the exit delay</strong>
                <p>
                  Seven days on Sepolia. The queue and any slashing stay keyed to the operator, so leaving is not an escape from a proposal
                  already filed.
                </p>
              </div>
            </li>
            <li>
              <span className='slashing__step'>3</span>
              <div>
                <strong>Claim</strong>
                <p>
                  <code>claimExitsFor</code> pays the collateral to the bond owner. Before <code>exitUnlocksAt</code> it reverts with
                  <code> ExitNotReady</code>.
                </p>
              </div>
            </li>
          </ol>
        </aside>
      </div>

      <p className='slashing__foot'>
        Appeals are not always available: <code>appealWindow</code> of zero means the slash executes immediately, and proof-verified slashes
        are appealable only when their policy sets a nonzero window. Check the policy for the reason you were cited under before assuming
        you have time.
      </p>
    </section>
  )
}
