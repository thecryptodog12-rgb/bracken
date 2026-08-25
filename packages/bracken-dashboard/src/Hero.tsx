// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// The opening moment.
//
// Before this every view began with a nav bar and a grey notice, which tells a
// first-time visitor nothing about what they landed on. A protocol whose whole
// claim is "nobody can read this" should say so once, at full size, before it
// starts listing things.
//
// One component, two sizes. `full` is the landing view: the canopy at full
// density and type that takes the screen. `compact` is what the other pages
// get — the same voice, a third of the height, so that arriving on the operator
// guide feels like the same product without re-announcing the whole thesis.

import type { ReactNode } from 'react'
import { Canopy } from '@bracken/diagrams'

type Stat = { value: string; label: string }

type Props = {
  eyebrow: ReactNode
  title: ReactNode
  lede?: ReactNode
  stats?: Stat[]
  size?: 'full' | 'compact'
}

export default function Hero({ eyebrow, title, lede, stats = [], size = 'full' }: Props) {
  const full = size === 'full'
  return (
    <section className={`hero hero--${size}`}>
      {/* Minder dicht op de compacte variant: daar is het sfeer, geen statement. */}
      <Canopy height={full ? 420 : 210} density={full ? 30 : 16} />

      <div className='hero__inner'>
        <div className='hero__eyebrow'>
          <span className='hero__pulse' aria-hidden='true' />
          {eyebrow}
        </div>

        <h1 className='hero__title'>{title}</h1>

        {lede && <p className='hero__lede'>{lede}</p>}

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
