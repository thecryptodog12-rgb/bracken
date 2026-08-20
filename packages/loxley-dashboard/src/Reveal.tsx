// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// Arrival.
//
// Sections rise in as they enter the viewport, which gives a long page a sense
// of being read rather than dumped. Three rules keep it from becoming the kind
// of scroll animation people disable:
//
//   1. It runs once. Nothing re-animates when you scroll back up.
//   2. It never hides content that failed to animate. The initial state is set
//      by a class the component adds itself, so a browser without
//      IntersectionObserver — or with JS half-loaded — shows everything.
//   3. Under prefers-reduced-motion it is skipped entirely, not merely sped up.

import { useEffect, useRef, useState, type ReactNode } from 'react'

export default function Reveal({ children, delay = 0, as: Tag = 'div' }: { children: ReactNode; delay?: number; as?: 'div' | 'section' }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (typeof IntersectionObserver === 'undefined') return
    const el = ref.current
    if (!el) return

    // Pas hier gaan we verbergen -- vóór dit punt staat de inhoud gewoon op
    // het scherm, en dat blijft zo als deze effect nooit draait.
    setArmed(true)

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          // isIntersecting alleen is niet genoeg. IntersectionObserver
          // rapporteert op frame-grenzen, dus een sprong -- een diepe anker-link,
          // een snelle scroll, cmd+End -- kan een sectie compleet overslaan. Die
          // bleef dan voorgoed op opacity 0 staan, wat precies de fout is die dit
          // component zou voorkomen. top < 0 betekent "we zijn er al voorbij":
          // ook tonen.
          if (e.isIntersecting || e.boundingClientRect.top < 0) {
            setShown(true)
            io.disconnect()
          }
        }
      },
      // threshold 0, niet een percentage: secties die hoger zijn dan het
      // scherm halen zo'n drempel nooit en zouden dus onzichtbaar blijven.
      { rootMargin: '0px 0px -12% 0px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${armed ? 'reveal--armed' : ''} ${shown ? 'is-in' : ''}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}
