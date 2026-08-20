// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// The opening moment.
//
// Before this the inspector began with a nav bar and a grey notice, which told
// a first-time visitor nothing about what they had landed on. A dashboard for a
// protocol whose whole claim is "nobody can read this" should say that once, at
// full size, before it starts listing things.
//
// The canopy behind the type is the same idea in motion rather than a texture
// picked for looking technical: a field of points you cannot read, a sweep that
// passes through, one point that resolves.

import { Canopy } from '@loxley/diagrams'

type Stat = { value: string; label: string }

export default function Hero({ chainId, stats }: { chainId: number; stats: Stat[] }) {
  return (
    <section className='hero'>
      <Canopy height={420} density={30} />

      <div className='hero__inner'>
        <div className='hero__eyebrow'>
          <span className='hero__pulse' aria-hidden='true' />
          Encrypted execution environments · chain {chainId}
        </div>

        <h1 className='hero__title'>
          Private inputs.
          <br />
          <em>Public outcomes.</em>
        </h1>

        <p className='hero__lede'>
          Loxley runs computations that nobody — not the requester, not a ciphernode, not whoever operates the network — can read the inputs
          of. What comes out is a single verified result, and a proof that it was produced correctly.
        </p>

        {stats.length > 0 && (
          <dl className='hero__stats'>
            {stats.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  )
}
