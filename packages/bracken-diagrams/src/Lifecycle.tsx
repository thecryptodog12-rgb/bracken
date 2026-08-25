// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// The E3 lifecycle, drawn as two lanes.
//
// The point of the diagram is the split, not the arrow: everything an operator
// or a voter contributes lives in the lower lane and never leaves it. Only one
// thing crosses up at the end -- the verified output. A single-lane flowchart
// would draw the same five boxes and say nothing about why this protocol is
// different from a server that promises to be nice.
//
// Stage numbers come from ./stages, which the dashboard asserts against the
// real IBracken.E3Stage enum at compile time -- the picture cannot drift from
// the contract without the build breaking.

import { E3_STAGES } from './stages'

type Step = {
  stage: number
  label: string
  /** Which lane the *work* of this stage happens in. */
  lane: 'public' | 'sealed'
  what: string
}

const STEPS: Step[] = [
  {
    stage: E3_STAGES.Requested,
    label: 'Requested',
    lane: 'public',
    what: 'Someone asks the network for a computation and pays the fee. The request is on-chain from this moment.',
  },
  {
    stage: E3_STAGES.CommitteeFinalized,
    label: 'Committee',
    lane: 'sealed',
    what: 'Sortition draws ciphernodes from the bonded set. They run a distributed key generation; every share stays with its node.',
  },
  {
    stage: E3_STAGES.KeyPublished,
    label: 'Key published',
    lane: 'public',
    what: 'The committee publishes one aggregated public key. Anyone can encrypt to it. Nobody holds the matching private key.',
  },
  {
    stage: E3_STAGES.CiphertextReady,
    label: 'Computed',
    lane: 'sealed',
    what: 'Inputs arrive already encrypted and the program runs on the ciphertext. No plaintext exists anywhere, at any point.',
  },
  {
    stage: E3_STAGES.Complete,
    label: 'Complete',
    lane: 'public',
    what: 'Enough ciphernodes publish decryption shares to open the result — and only the result — with a proof it was computed correctly.',
  },
]

// Geometrie: één kolom per stap, twee vaste banen.
const W = 920
const H = 268
const PAD_X = 56
const COL = (W - PAD_X * 2) / (STEPS.length - 1)
const Y_PUBLIC = 74
const Y_SEALED = 190
const x = (i: number) => PAD_X + i * COL
const y = (lane: Step['lane']) => (lane === 'public' ? Y_PUBLIC : Y_SEALED)

export default function Lifecycle() {
  return (
    <figure className='lxd lifecycle'>
      <figcaption className='lifecycle__cap'>
        <span className='lxd-eyebrow'>How an E3 runs</span>
        <p>
          Five stages, straight from the <code>E3Stage</code> enum the contract uses. The lower lane is the part that never becomes readable
          — not to a ciphernode, not to the requester, not to whoever is running the network.
        </p>
      </figcaption>

      <svg className='lifecycle__svg' viewBox={`0 0 ${W} ${H}`} role='img' aria-labelledby='lc-title lc-desc'>
        <title id='lc-title'>The five stages of an encrypted execution environment</title>
        <desc id='lc-desc'>
          A request is made publicly on-chain, a ciphernode committee is drawn and generates a key without any node holding the whole
          secret, the public key is published, inputs are encrypted and computed on without ever being decrypted, and finally only the
          verified output is revealed.
        </desc>

        {/* ── banen ─────────────────────────────────────────────────────── */}
        <rect x='0' y='34' width={W} height='72' rx='12' className='lc-band lc-band--public' />
        <rect x='0' y='150' width={W} height='72' rx='12' className='lc-band lc-band--sealed' />

        <text x='14' y='26' className='lc-lane-label'>
          PUBLIC · ON CHAIN, ANYONE CAN CHECK
        </text>
        <text x='14' y='242' className='lc-lane-label lc-lane-label--sealed'>
          SEALED · NO SINGLE PARTY CAN READ IT
        </text>

        {/* ── verbindingen: de lijn zakt en stijgt met de banen ─────────── */}
        {STEPS.slice(0, -1).map((s, i) => {
          const next = STEPS[i + 1]
          const x1 = x(i)
          const x2 = x(i + 1)
          const y1 = y(s.lane)
          const y2 = y(next.lane)
          const mid = (x1 + x2) / 2
          // De laatste overgang is de enige die iets naar buiten brengt.
          const isReveal = next.stage === E3_STAGES.Complete
          return (
            <path
              key={s.stage}
              d={`M ${x1 + 15} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2 - 15} ${y2}`}
              className={`lc-link ${isReveal ? 'lc-link--reveal' : ''}`}
            />
          )
        })}

        {/* ── knopen ────────────────────────────────────────────────────── */}
        {STEPS.map((s, i) => (
          <g key={s.stage} className={`lc-node lc-node--${s.lane}`}>
            <circle cx={x(i)} cy={y(s.lane)} r='13' className='lc-node__ring' />
            <text x={x(i)} y={y(s.lane) + 4} className='lc-node__num'>
              {s.stage}
            </text>
            <text x={x(i)} y={y(s.lane) + (s.lane === 'public' ? -26 : 34)} className='lc-node__label'>
              {s.label}
            </text>
          </g>
        ))}
      </svg>

      <ol className='lifecycle__steps'>
        {STEPS.map((s) => (
          <li key={s.stage} className={`lifecycle__step lifecycle__step--${s.lane}`}>
            <span className='lifecycle__step-num'>{s.stage}</span>
            <div>
              <h4>{s.label}</h4>
              <p>{s.what}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className='lifecycle__foot'>
        There is a sixth value in the enum — <code>Failed ({E3_STAGES.Failed})</code>. An E3 that never gathers enough decryption shares
        ends there, the fee is refunded through the E3RefundManager, and the inputs stay sealed forever. Nothing half-opens.
      </p>
    </figure>
  )
}
