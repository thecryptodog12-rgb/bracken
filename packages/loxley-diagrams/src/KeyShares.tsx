// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// The threshold, made tactile.
//
// Every other diagram here explains a sequence. This one explains a *number* —
// T+1 — and a number is the hardest thing to make anyone feel. So it is the one
// piece you operate rather than read: click ciphernodes to collect their
// decryption shares and watch the result stay shut until you cross the
// threshold, then open all at once.
//
// The discontinuity is the whole point. Partial collection does not give you a
// partial answer, a blurry answer, or a probabilistic one. It gives you
// nothing, and then it gives you everything. People who have only ever met
// password-style secrets expect a gradient, and the absence of one is exactly
// what threshold cryptography buys.

import { useMemo, useState } from 'react'

const N = 7
const THRESHOLD = 4 // T+1 shares needed
const R = 118
const CX = 190
const CY = 150

type Props = { className?: string }

export default function KeyShares({ className = '' }: Props) {
  const [held, setHeld] = useState<Set<number>>(() => new Set())

  const nodes = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => {
        // Halve cirkel plus wat marge, zodat de knopen boven de sleutel hangen
        // in plaats van eromheen te zweven.
        const a = Math.PI * (0.08 + (0.84 * i) / (N - 1)) + Math.PI
        return { i, x: CX + Math.cos(a) * R, y: CY + Math.sin(a) * R * 0.92 }
      }),
    [],
  )

  const open = held.size >= THRESHOLD
  const toggle = (i: number) =>
    setHeld((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <section className={`lxd keyshares ${open ? 'is-open' : ''} ${className}`} aria-label='How the decryption threshold works'>
      <div className='keyshares__head'>
        <span className='lxd-eyebrow'>The threshold</span>
        <h2 className='keyshares__title'>
          Three shares open <em>nothing</em>.
        </h2>
        <p className='keyshares__lede'>
          A committee of {N} each holds one share of a key that was never assembled anywhere. Collect them one at a time. Nothing happens,
          and nothing keeps happening, until the {THRESHOLD}
          <sup>th</sup>.
        </p>
      </div>

      <div className='keyshares__stage'>
        <svg
          viewBox='0 0 380 250'
          className='keyshares__svg'
          role='img'
          aria-label={`${held.size} of ${N} shares collected. ${open ? 'The output is open.' : `${THRESHOLD - held.size} more needed.`}`}
        >
          {nodes.map((n) => (
            <line
              key={`l${n.i}`}
              x1={n.x}
              y1={n.y}
              x2={CX}
              y2={CY}
              className={`ks-link ${held.has(n.i) ? 'is-held' : ''} ${open ? 'is-open' : ''}`}
            />
          ))}

          {/* De sleutel zelf: gesloten tot de drempel, dan open. */}
          <g className='ks-core'>
            <circle cx={CX} cy={CY} r='30' className='ks-core__ring' />
            <text x={CX} y={CY + 5} className='ks-core__label'>
              {open ? 'OPEN' : `${held.size}/${THRESHOLD}`}
            </text>
          </g>

          {nodes.map((n) => (
            <g
              key={n.i}
              className={`ks-node ${held.has(n.i) ? 'is-held' : ''}`}
              onClick={() => toggle(n.i)}
              role='button'
              tabIndex={0}
              aria-pressed={held.has(n.i)}
              aria-label={`Share from ciphernode ${n.i + 1}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggle(n.i)
                }
              }}
            >
              <circle cx={n.x} cy={n.y} r='15' className='ks-node__hit' />
              <circle cx={n.x} cy={n.y} r='9' className='ks-node__dot' />
            </g>
          ))}
        </svg>

        <div className='keyshares__side'>
          <p className={`keyshares__verdict ${open ? 'is-open' : ''}`}>
            {open
              ? 'The plaintext is out — and only the plaintext.'
              : `${THRESHOLD - held.size} more share${THRESHOLD - held.size === 1 ? '' : 's'} and it opens.`}
          </p>
          <p className='keyshares__note'>
            {open
              ? 'No node ever held the key. It was reconstructed from shares for exactly this one output, and the individual inputs stayed sealed.'
              : 'Every share you have so far is mathematically independent of the answer. Not a hint, not a narrowing — nothing.'}
          </p>
          <button className='lxd-btn' onClick={() => setHeld(new Set())} disabled={held.size === 0}>
            Reset
          </button>
        </div>
      </div>

      <p className='keyshares__foot'>
        The real committee size and threshold are set per program, not fixed at {N} and {THRESHOLD}; deployments tune them. What does not
        change is the shape: below the line you learn nothing, and there is no arrangement of fewer shares that gets you partway.
      </p>
    </section>
  )
}
