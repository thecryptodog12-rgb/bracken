// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// De ops-view: het scherm dat laat zien dat er iets draait.
//
// De bestaande secties leggen elk één ding grondig uit. Geen van hen beantwoordt
// de vraag die iemand stelt die het scherm voor het eerst ziet -- draait dit, en
// wat doet het nu. Daar is dichtheid voor nodig: meerdere panelen tegelijk, een
// stroom die beweegt, cijfers die je kunt aflezen zonder te klikken.
//
// Alles hier komt uit één bron (lib/demo) zolang er geen deployment is, en die
// bron draagt zijn eigen label mee. Zie de kop van dat bestand.

import { useEffect, useRef, useState } from 'react'
import { DEMO, DEMO_E3S, DEMO_LOG, DEMO_NODES, DEMO_SLOTS, type DemoLogLine } from './lib/demo'
import { E3Stage } from './lib/chain'
import { useAllE3s } from './lib/useE3s'

const STAGE_LABEL: Record<number, string> = {
  0: 'none',
  1: 'requested',
  2: 'committee',
  3: 'key published',
  4: 'ciphertext',
  5: 'complete',
  6: 'failed',
}

const STAGE_KIND: Record<number, string> = {
  6: 'bad',
  5: 'ok',
  4: 'live',
  3: 'live',
  2: 'live',
  1: 'wait',
}

// De logstroom loopt op een eigen klok. Bewust traag: een regel per 2,4 s leest
// als een netwerk dat werkt, niet als een demo die zichzelf probeert te bewijzen.
function useLogStream(lines: DemoLogLine[], intervalMs = 2400) {
  const [n, setN] = useState(6)
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduced.current) {
      setN(lines.length)
      return
    }
    const id = window.setInterval(() => setN((v) => (v >= lines.length ? 6 : v + 1)), intervalMs)
    return () => window.clearInterval(id)
  }, [lines.length, intervalMs])

  return lines.slice(0, n).slice(-9).reverse()
}

function useClock() {
  const [t, setT] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setT(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return t.toLocaleTimeString('en-GB', { hour12: false })
}

export default function Ops({ onNav }: { onNav: (id: string) => void }) {
  const log = useLogStream(DEMO_LOG)
  const clock = useClock()
  const live = useAllE3s()

  // Welke bron dit scherm toont.
  //
  // Dit ging eerder mis en het is de ergste vorm waarin het mis kon gaan: de
  // statusbalk sprong op 'live' zodra er een contractadres geconfigureerd was,
  // maar de panelen bleven onvoorwaardelijk DEMO_* lezen. Het scherm beweerde
  // dus dat een verzonnen netwerk op keten 4663 draaide, zonder enig teken dat
  // het verzonnen was -- precies wat het demo-label moest voorkomen.
  //
  // Eén bron, één keer gekozen, en niets in dit bestand mag er nog omheen.
  const e3s = DEMO ? DEMO_E3S : (live.data ?? [])
  const nodes = DEMO ? DEMO_NODES : []
  const slots = DEMO ? DEMO_SLOTS : []
  const loading = !DEMO && live.status === 'loading'

  const seated = nodes.filter((n) => n.state === 'seated').length
  const slashed = nodes.filter((n) => n.state === 'slashed').length
  const complete = e3s.filter((e) => e.stage === E3Stage.Complete).length
  const running = e3s.filter((e) => e.stage > 0 && e.stage < E3Stage.Complete).length
  const ballots = e3s.reduce((s, e) => s + e.ballotCount, 0)

  return (
    <section className='ops'>
      {/* Het label hangt aan de view zelf, niet aan een los bannertje dat je
          kunt sluiten of vergeten. Zonder demo-modus verdwijnt deze balk. */}
      {DEMO && (
        <div className='ops__demo' role='note'>
          <span className='ops__demo-tag'>Demo</span>
          <p>
            This is a <strong>fabricated network</strong>, not a chain. Nothing below has been deployed, no committee exists, and no
            ciphernode is running. It shows what the protocol looks like in motion — the same screen reads chain 4663 the moment a
            deployment exists.
          </p>
        </div>
      )}

      <div className='ops__bar'>
        <span className='ops__brand'>BRACKEN</span>
        <Stat k='chain' v='4663' />
        <Stat k='e3 complete' v={String(complete)} />
        <Stat k='running' v={String(running)} />
        <Stat k='seated' v={`${seated}/${nodes.length}`} />
        <Stat k='inputs' v={ballots.toLocaleString('en-GB')} />
        <span className='ops__bar-spacer' />
        <span className={`ops__pulse ${DEMO ? 'is-demo' : 'is-live'}`} aria-hidden='true' />
        <span className='ops__mode'>{DEMO ? 'demo' : 'live'}</span>
        <span className='ops__clock mono'>{clock}</span>
      </div>

      <div className='ops__grid'>
        <Panel title='E3 queue' meta={loading ? 'reading chain…' : `${e3s.length} recent`} span={2}>
          <table className='ops__table'>
            <thead>
              <tr>
                <th>id</th>
                <th>stage</th>
                <th>committee</th>
                <th className='num'>inputs</th>
              </tr>
            </thead>
            <tbody>
              {e3s.map((e) => (
                <tr key={String(e.id)}>
                  <td className='mono'>#{String(e.id).padStart(4, '0')}</td>
                  <td>
                    <span className={`ops__dot is-${STAGE_KIND[e.stage] ?? 'wait'}`} aria-hidden='true' />
                    {STAGE_LABEL[e.stage] ?? '—'}
                  </td>
                  <td className='mono'>{e.committeeSize}</td>
                  <td className='num mono'>{e.ballotCount || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!e3s.length && <p className='ops__empty'>{loading ? 'Reading chain…' : 'No E3 has been requested yet.'}</p>}
        </Panel>

        <Panel title='Committee pool' meta={`${seated} seated · ${slashed} slashed`}>
          <ul className='ops__nodes'>
            {nodes.map((n) => (
              <li key={n.label}>
                <span
                  className={`ops__dot is-${n.state === 'seated' ? 'ok' : n.state === 'slashed' ? 'bad' : 'idle'}`}
                  aria-hidden='true'
                />
                <span className='mono ops__node-id'>{n.label}</span>
                <span className='ops__node-state'>{n.state}</span>
                <span className='mono ops__node-bond'>{n.bond.toLocaleString('en-GB')}</span>
              </li>
            ))}
          </ul>
          {!nodes.length && (
            <p className='ops__empty'>
              No ciphernode has bonded yet. Committee membership needs operators; see{' '}
              <button className='ops__link' onClick={() => onNav('operator')}>
                Run a ciphernode
              </button>
              .
            </p>
          )}
        </Panel>

        <Panel title='Verifier slots' meta='three proofs'>
          <ul className='ops__slots'>
            {slots.map((s) => (
              <li key={s.label}>
                <span className='ops__dot is-ok' aria-hidden='true' />
                <span className='ops__slot-name'>{s.label}</span>
                <span className='ops__slot-note'>{s.note}</span>
              </li>
            ))}
          </ul>
          {!slots.length && <p className='ops__empty'>Read directly off chain, not summarised here.</p>}
          <button className='ops__link' onClick={() => onNav('audit')}>
            {slots.length ? 'Read the real slots on chain →' : 'Open the verifier audit →'}
          </button>
        </Panel>

        {/* De logstroom is gefabriceerd, dus die hoort alleen bij de demo. Een
            verzonnen log onder een 'live'-balk is een verzonnen bewering. */}
        {DEMO && (
          <Panel title='Event log' meta='demo' span={3}>
            <ul className='ops__log'>
              {log.map((l, i) => (
                <li key={`${l.tag}-${i}`} className={i === 0 ? 'is-new' : ''}>
                  <span className={`ops__log-tag is-${l.kind}`}>{l.tag}</span>
                  <span className='ops__log-text'>{l.text}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </section>
  )
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <span className='ops__stat'>
      <span className='ops__stat-k'>{k}</span>
      <span className='ops__stat-v mono'>{v}</span>
    </span>
  )
}

function Panel({ title, meta, span = 1, children }: { title: string; meta?: string; span?: number; children: React.ReactNode }) {
  return (
    <article className={`ops__panel ops__panel--${span}`}>
      <header className='ops__panel-head'>
        <h3>{title}</h3>
        {meta && <span className='ops__panel-meta mono'>{meta}</span>}
      </header>
      <div className='ops__panel-body'>{children}</div>
    </article>
  )
}
