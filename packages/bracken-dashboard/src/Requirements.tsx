// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// What it takes to run a ciphernode.
//
// Deliberately renders WITHOUT a chain connection. The operator page used to be
// a blank slab whenever the RPC was unreachable, which is exactly the moment
// someone is deciding whether this is worth their time. Hardware, OS and
// software requirements are protocol facts, not chain state -- they belong on
// the page either way.
//
// The collateral figures DO come from the BondingRegistry, so they are shown as
// live values when we have them and as an explicit "unavailable" when we do
// not. Never a plausible-looking placeholder: a wrong bond number is the kind
// of thing someone budgets against.

import { useMemo, useState } from 'react'
import type { BondingConfig } from './lib/bonding'

type Tier = 'min' | 'rec'

const HARDWARE: Record<Tier, { label: string; note: string; rows: [string, string][] }> = {
  min: {
    label: 'Minimum',
    note: 'Enough to run a node on a test network and take part in committees.',
    rows: [
      ['CPU', '4+ modern cores (x86-64)'],
      ['RAM', '16 GB'],
      ['Disk', '100 GB SSD'],
      ['Network', 'Stable broadband, UDP open for QUIC'],
    ],
  },
  rec: {
    label: 'Recommended',
    note: 'DKG and proof generation are CPU- and memory-bound. Under-provision and you miss submission windows.',
    rows: [
      ['CPU', '8+ modern cores (x86-64, AVX2)'],
      ['RAM', '32 GB DDR5 (or DDR4 ECC)'],
      ['Disk', '500 GB NVMe SSD'],
      ['Network', 'Low-latency broadband, unfiltered UDP'],
    ],
  },
}

const PLATFORMS: [string, string, 'yes' | 'partial'][] = [
  ['Linux', 'x86_64 — primary target', 'yes'],
  ['macOS', 'Apple Silicon binaries available', 'yes'],
  ['Windows', 'Via WSL2 or the Docker image', 'partial'],
]

const SOFTWARE: [string, string][] = [
  ['Bracken CLI', 'Node management and on-chain operations'],
  ['Rust 1.91.1+', 'Only needed when building from source'],
  ['WebSocket RPC', 'A wss:// endpoint — HTTP-only falls back to polling and drops events'],
]

const DISK: [string, string][] = [
  ['Node state', '10–50 GB'],
  ['Circuit artifacts', '5–15 GB'],
  ['Logs (rotated)', '1–10 GB'],
]

function fmtUnits(value: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals)
  const whole = value / base
  const frac = value % base
  if (frac === 0n) return whole.toLocaleString('en-US')
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 4)
  return `${whole.toLocaleString('en-US')}.${fracStr}`
}

export default function Requirements({ config }: { config: BondingConfig | null }) {
  const [tier, setTier] = useState<Tier>('rec')
  const [tickets, setTickets] = useState('1')

  // Tickets are the one number an operator actually chooses, so let them see
  // what choosing it costs before they connect a wallet.
  const ticketMath = useMemo(() => {
    if (!config) return null
    const n = /^\d+$/.test(tickets.trim()) ? BigInt(tickets.trim()) : null
    if (n === null || n === 0n) return null
    return {
      count: n,
      total: config.ticketPrice * n,
      decimals: config.ticketDecimals,
      symbol: config.ticketSymbol,
    }
  }, [config, tickets])

  const hw = HARDWARE[tier]

  return (
    <section className='reqs' aria-label='Ciphernode requirements'>
      <div className='reqs__head'>
        <h2 className='reqs__title'>What you need</h2>
        <p className='reqs__lede'>
          A ciphernode holds key shares, is drawn into committees by sortition, and produces decryption shares on time. Miss your duties and
          the bond is slashable — so the machine matters as much as the collateral.
        </p>
      </div>

      <div className='reqs__grid'>
        {/* ── Collateral: chain state, shown honestly ─────────────────── */}
        <article className='reqs__card reqs__card--wide'>
          <header className='reqs__card-head'>
            <h3>Collateral</h3>
            <span className='reqs__src'>from BondingRegistry</span>
          </header>

          {config ? (
            <>
              <dl className='reqs__figures'>
                <div>
                  <dt>Ciphernode bond</dt>
                  <dd className='reqs__figure'>
                    {fmtUnits(config.requiredCiphernodeBond, config.ciphernodeBondDecimals)} <span>{config.ciphernodeBondSymbol}</span>
                  </dd>
                </div>
                <div>
                  <dt>Per ticket</dt>
                  <dd className='reqs__figure'>
                    {fmtUnits(config.ticketPrice, config.ticketDecimals)} <span>{config.ticketSymbol}</span>
                  </dd>
                </div>
                <div>
                  <dt>Minimum tickets</dt>
                  <dd className='reqs__figure'>{config.minTicketBalance.toString()}</dd>
                </div>
              </dl>

              <div className='reqs__calc'>
                <label htmlFor='req-tickets'>Tickets you want</label>
                <input
                  id='req-tickets'
                  className='reqs__input'
                  inputMode='numeric'
                  value={tickets}
                  onChange={(e) => setTickets(e.target.value)}
                  aria-describedby='req-tickets-out'
                />
                <p id='req-tickets-out' className='reqs__calc-out'>
                  {ticketMath ? (
                    <>
                      needs{' '}
                      <strong>
                        {fmtUnits(ticketMath.total, ticketMath.decimals)} {ticketMath.symbol}
                      </strong>{' '}
                      of ticket collateral, on top of the bond
                    </>
                  ) : (
                    <span className='reqs__muted'>enter a whole number of tickets</span>
                  )}
                </p>
              </div>
            </>
          ) : (
            <p className='reqs__unavailable'>
              Live collateral figures need a reachable bonding registry. They are deliberately not shown as placeholders here — a wrong bond
              figure is the kind of number people budget against.
            </p>
          )}

          <p className='reqs__foot'>You also need the chain&apos;s native token for gas on every registration and bonding transaction.</p>
        </article>

        {/* ── Hardware: protocol facts, always available ──────────────── */}
        <article className='reqs__card'>
          <header className='reqs__card-head'>
            <h3>Hardware</h3>
            <div className='reqs__seg' role='group' aria-label='Hardware tier'>
              {(['min', 'rec'] as Tier[]).map((t) => (
                <button
                  key={t}
                  className={`reqs__seg-btn ${tier === t ? 'is-on' : ''}`}
                  onClick={() => setTier(t)}
                  aria-pressed={tier === t}
                >
                  {HARDWARE[t].label}
                </button>
              ))}
            </div>
          </header>
          <dl className='reqs__rows'>
            {hw.rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className='reqs__foot'>{hw.note}</p>
        </article>

        <article className='reqs__card'>
          <header className='reqs__card-head'>
            <h3>Platform</h3>
          </header>
          <dl className='reqs__rows'>
            {PLATFORMS.map(([name, note, level]) => (
              <div key={name}>
                <dt>
                  {name}
                  <span className={`reqs__dot reqs__dot--${level}`} aria-hidden='true' />
                </dt>
                <dd>{note}</dd>
              </div>
            ))}
          </dl>
        </article>

        <article className='reqs__card'>
          <header className='reqs__card-head'>
            <h3>Software</h3>
          </header>
          <dl className='reqs__rows'>
            {SOFTWARE.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </article>

        <article className='reqs__card'>
          <header className='reqs__card-head'>
            <h3>Disk budget</h3>
            <span className='reqs__src'>steady state</span>
          </header>
          <dl className='reqs__rows'>
            {DISK.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className='reqs__foot'>
            Baseline lands around 30–100 GB. Provision well past it for log retention and running more than one network.
          </p>
        </article>
      </div>
    </section>
  )
}
