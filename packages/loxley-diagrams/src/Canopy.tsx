// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// The signature visual: a greenwood canopy of sealed points.
//
// It is not decoration with a story bolted on afterwards. The field is what an
// E3 looks like from outside — hundreds of contributions you cannot read, all
// of them the same dim shape. A sweep passes through at intervals, the way a
// seed lands and a committee is drawn, and the points it touches brighten for a
// moment. Then exactly one resolves: bright, green, briefly ringed. That is the
// only thing this protocol ever lets out.
//
// Everything is drawn from a fixed seed, so the composition is the same on
// every load and can be reasoned about rather than being different noise each
// time. Under prefers-reduced-motion it renders one frame and stops — the image
// survives, the movement does not.

import { useEffect, useRef } from 'react'

type Props = {
  /** Height in CSS pixels. The field scales its density to the area. */
  height?: number
  /** Points per 10k css px². Lower reads calmer, higher reads denser. */
  density?: number
  className?: string
}

type Pt = { x: number; y: number; r: number; base: number; phase: number; drift: number }

// Kleine deterministische PRNG (mulberry32) -- zelfde veld bij elke load.
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const readVar = (el: HTMLElement, name: string, fallback: string) => {
  const v = getComputedStyle(el).getPropertyValue(name).trim()
  return v || fallback
}

export default function Canopy({ height = 340, density = 26, className = '' }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let raf = 0
    let points: Pt[] = []
    let w = 0
    let h = 0
    let start = performance.now()

    // Kleuren komen uit de host-tokens, niet uit deze module.
    let inkFaint = '#8ba392'
    let accent = '#1c5c3f'
    let warn = '#9a7328'

    const build = () => {
      const rect = wrap.getBoundingClientRect()
      w = Math.max(1, Math.round(rect.width))
      h = Math.max(1, Math.round(height))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      inkFaint = readVar(wrap, '--lxd-ink-faint', inkFaint)
      accent = readVar(wrap, '--lxd-accent', accent)
      warn = readVar(wrap, '--lxd-warn', warn)

      const n = Math.round(((w * h) / 10000) * density)
      const rand = rng(0x10c1e7)
      points = Array.from({ length: n }, () => {
        const rx = rand()
        const ry = rand()
        // Bovenaan dichter dan onderaan: een kruin, geen egale ruis. De pagina
        // eronder moet er doorheen kunnen ademen.
        const y = Math.pow(ry, 0.62) * h
        return {
          x: rx * w,
          y,
          r: 0.7 + rand() * 1.5,
          base: 0.1 + rand() * 0.3,
          phase: rand() * Math.PI * 2,
          drift: 0.2 + rand() * 0.6,
        }
      })
    }

    const draw = (now: number) => {
      const t = (now - start) / 1000
      ctx.clearRect(0, 0, w, h)

      // De sweep: elke 9 seconden trekt er iets van links naar rechts.
      const period = 9
      const sweep = ((t % period) / period) * (w * 1.35) - w * 0.18
      const reveal = Math.max(0, Math.min(1, (t % period) / period - 0.72)) / 0.28

      for (const p of points) {
        const dy = motion.matches ? 0 : Math.sin(t * 0.35 * p.drift + p.phase) * 2.2
        const d = Math.abs(p.x - sweep)
        const lit = motion.matches ? 0 : Math.max(0, 1 - d / 110)
        const a = p.base + lit * 0.5

        ctx.beginPath()
        ctx.arc(p.x, p.y + dy, p.r + lit * 0.9, 0, Math.PI * 2)
        ctx.fillStyle = lit > 0.35 ? accent : inkFaint
        ctx.globalAlpha = a
        ctx.fill()
      }

      // Precies één punt lost op, aan het eind van elke sweep.
      if (points.length && !motion.matches && reveal > 0) {
        const p = points[Math.floor(points.length * 0.37)]
        const e = Math.sin(reveal * Math.PI)
        ctx.globalAlpha = e
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2)
        ctx.fillStyle = warn
        ctx.fill()
        ctx.globalAlpha = e * 0.55
        ctx.beginPath()
        ctx.arc(p.x, p.y, 6 + e * 12, 0, Math.PI * 2)
        ctx.strokeStyle = warn
        ctx.lineWidth = 1
        ctx.stroke()
      }

      ctx.globalAlpha = 1
      if (!motion.matches) raf = requestAnimationFrame(draw)
    }

    const restart = () => {
      cancelAnimationFrame(raf)
      build()
      start = performance.now()
      raf = requestAnimationFrame(draw)
    }

    restart()
    const ro = new ResizeObserver(restart)
    ro.observe(wrap)
    motion.addEventListener('change', restart)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      motion.removeEventListener('change', restart)
    }
  }, [height, density])

  return (
    <div ref={wrapRef} className={`lxd lxd-canopy ${className}`} aria-hidden='true'>
      <canvas ref={canvasRef} />
    </div>
  )
}
