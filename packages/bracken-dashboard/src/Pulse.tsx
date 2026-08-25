// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
// Network pulse — small, low-emphasis footer strip.
//
// Deze strook stond onder elke view "All systems nominal" te melden terwijl er
// nul van alles was. Bij een leeg netwerk is dat geen geruststelling maar een
// onwaarheid, en pal onder de ops-view sprak hij de demo tegen: druk scherm
// boven, drie nullen eronder. Nu volgt hij dezelfde bron als de rest.

import { DEMO, DEMO_ACTIVE, DEMO_BALLOTS, DEMO_POLLS } from './lib/demo'

export default function Pulse({ data }: { data: { activeNow: number; ballots24h: number; pollsAllTime: number } }) {
  const empty = data.activeNow === 0 && data.ballots24h === 0 && data.pollsAllTime === 0
  if (DEMO) data = { activeNow: DEMO_ACTIVE, ballots24h: DEMO_BALLOTS, pollsAllTime: DEMO_POLLS }
  return (
    <section className='pulse' aria-label='Network activity'>
      <div className='pulse__inner'>
        <div className='pulse__brand'>
          <span className='pulse__brand-mark' aria-hidden='true' />
          <span>Bracken network</span>
        </div>
        <div className='pulse__metrics'>
          <div className='pulse__metric'>
            <span className='pulse__metric-num mono'>{data.activeNow}</span>
            <span className='pulse__metric-label'>active E3{data.activeNow === 1 ? '' : 's'} right now</span>
          </div>
          <div className='pulse__metric'>
            <span className='pulse__metric-num mono'>{data.ballots24h.toLocaleString()}</span>
            <span className='pulse__metric-label'>encrypted ballots, last 24h</span>
          </div>
          <div className='pulse__metric'>
            <span className='pulse__metric-num mono'>{data.pollsAllTime.toLocaleString()}</span>
            <span className='pulse__metric-label'>CRISP polls, all-time</span>
          </div>
        </div>
        <div className='pulse__status'>
          <span className={`pulse__status-dot ${empty ? 'is-idle' : ''}`} />
          {/* "Nothing deployed" en "geen activiteit" zijn twee verschillende
              dingen. Buiten demo-modus staat er per definitie een contractadres
              geconfigureerd, dus nul betekent hier: het staat er, er is alleen
              nog niets gebeurd. */}
          <span>{DEMO ? 'Demo data · nothing deployed' : empty ? 'Deployed · no activity yet' : 'All systems nominal'}</span>
        </div>
      </div>
    </section>
  )
}
