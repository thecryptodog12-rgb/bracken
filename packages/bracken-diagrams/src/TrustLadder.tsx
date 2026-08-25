// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// What you still have to trust.
//
// The docs call it the coordination trilemma: keep inputs confidential, let no
// single party control decryption, and still make every step publicly
// checkable. Classical threshold crypto buys the first two and leaves observers
// assuming the right nodes ran the right steps.
//
// Rather than draw the usual triangle, this shows the thing that actually
// persuades: a bar that shrinks. Each mechanism removes a specific assumption,
// and the label says which. The last bar is deliberately not empty — there is
// always residual trust, and a diagram that claimed otherwise would be lying
// about the one thing readers are here to check.

import { useEffect, useRef, useState } from 'react'

type Rung = {
  setup: string
  mechanism: string
  /** Share of the original trust surface still standing, 0–1. */
  remaining: number
  stillTrust: string
}

const RUNGS: Rung[] = [
  {
    setup: 'A server that promises',
    mechanism: 'nothing — you take their word',
    remaining: 1,
    stillTrust: 'That the operator does not read your inputs, does not keep them, and runs the program they said they would.',
  },
  {
    setup: 'Threshold BFV + distributed key generation',
    mechanism: 'no trusted dealer; no single party holds the key',
    remaining: 0.52,
    stillTrust: 'That enough committee members are honest, and that the program evaluated on your ciphertext was the right one.',
  },
  {
    setup: 'Zero-knowledge proofs on every step',
    mechanism: 'PVDKG and decryption proofs, publicly checkable',
    remaining: 0.24,
    stillTrust: 'That the threshold assumption holds — that fewer than T+1 members collude.',
  },
  {
    setup: 'Bonding, sortition and slashing',
    mechanism: 'misbehaviour is detectable and expensive',
    remaining: 0.12,
    stillTrust: 'That colluding is worth less than the bonds it would burn. Economics, not mathematics — and the honest place to stop.',
  },
]

export default function TrustLadder() {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current as HTMLElement | null
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es)
          // Zie Reveal.tsx: een sprong kan de sectie overslaan, en dan zouden
          // de balken voorgoed op 100% blijven staan.
          if (e.isIntersecting || e.boundingClientRect.top < 0) {
            setShown(true)
            io.disconnect()
          }
      },
      // threshold moet 0 blijven: deze sectie is hoger dan het scherm, en dan
      // wordt een drempel op een percentage van het element zelf nooit gehaald.
      // De rootMargin doet het werk -- hij vuurt zodra de bovenkant binnenkomt.
      { threshold: 0, rootMargin: '0px 0px -15% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section className={`lxd trustladder ${shown ? 'is-in' : ''}`} ref={ref as never} aria-label='What you still have to trust'>
      <div className='trustladder__head'>
        <span className='lxd-eyebrow'>Why trust this</span>
        <h2 className='trustladder__title'>Every layer removes an assumption.</h2>
        <p className='trustladder__lede'>
          Confidentiality on its own is a promise. What makes it checkable is that each mechanism takes away something specific you would
          otherwise have to take on faith — and says what is left.
        </p>
      </div>

      <ol className='trustladder__rungs'>
        {RUNGS.map((r, i) => (
          <li key={r.setup} className={`trustladder__rung ${i === RUNGS.length - 1 ? 'is-last' : ''}`}>
            <div className='trustladder__label'>
              <h3>{r.setup}</h3>
              <p className='trustladder__mech'>{r.mechanism}</p>
            </div>

            <div className='trustladder__meter' aria-hidden='true'>
              <div className='trustladder__track'>
                <div
                  className='trustladder__fill'
                  style={{ width: shown ? `${r.remaining * 100}%` : '100%', transitionDelay: `${i * 140}ms` }}
                />
              </div>
              <span className='trustladder__pct'>{Math.round(r.remaining * 100)}%</span>
            </div>

            <p className='trustladder__still'>
              <span>Still trusted:</span> {r.stillTrust}
            </p>
          </li>
        ))}
      </ol>

      <p className='trustladder__foot'>
        The bars are a reading aid, not a measurement — there is no unit in which trust is 12%. What is exact is the wording next to them:
        each line names an assumption that the layer above it no longer requires.
      </p>
    </section>
  )
}
