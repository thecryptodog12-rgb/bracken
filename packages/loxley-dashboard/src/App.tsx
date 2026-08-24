// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
// Main app shell + tweak wiring.

import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { STAGES, type Poll } from './data'
import PollCard from './PollCard'
import Timeline from './Timeline'
import History from './History'
import Pulse from './Pulse'
import Inspector from './Inspector'
import Loader from './Loader'
import Operator from './Operator'
import { BallotPrivacy, KeyShares, Lifecycle, TrustLadder } from '@loxley/diagrams'
import { useAllE3s, useCrispPolls, useE3Details, useRecentBallots } from './lib/useE3s'
import { adaptHistoryEntries, adaptInspectorDetail, adaptInspectorE3List, adaptPoll } from './lib/adapt'
import { formatE3Id } from './lib/pollMeta'
import { LINKS, explorerAddress } from './lib/links'
import { CONTRACTS } from './lib/chain'
import { isE3Active, solidityStageToUiIdx, type E3FullDetails, type E3Summary } from './lib/e3'
import { Wordmark } from './Wordmark'
import ThemeToggle from './ThemeToggle'
import Hero from './Hero'
import VerifierAudit from './VerifierAudit'
import Reveal from './Reveal'

const NAV: [string, string][] = [
  ['inspector', 'E3 inspector'],
  ['crisp', 'CRISP'],
  ['operator', 'Run a ciphernode'],
  ['audit', 'Verifier audit'],
]

function Header({ density, view, onNav }: { density: string; view: string; onNav: (id: string) => void }) {
  // Onder 880px was .site-nav simpelweg verborgen, zonder iets ervoor in de
  // plaats. Je landde op een pagina en kon nergens meer heen -- geen ontbrekend
  // extraatje maar een doodlopende navigatie.
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    // Achtergrond niet mee laten scrollen zolang het paneel open staat.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  const go = (id: string) => {
    setMenuOpen(false)
    onNav(id)
  }

  const link = (id: string, label: string) => (
    <a
      className={`site-nav__link ${view === id ? 'site-nav__link--on' : ''}`}
      href={`#${id}`}
      onClick={(e) => {
        e.preventDefault()
        onNav(id)
      }}
    >
      {label}
    </a>
  )
  return (
    <header className={`site-head site-head--${density}`}>
      <div className='site-head__inner'>
        {/* Het merk wijst naar de begin-page, niet naar de eerste sectie van
            deze pagina zelf. Dat is waar bezoekers het klikken, en het was tot
            nu toe de enige plek waar de voordeur niet vandaan te bereiken was. */}
        <a className='wordmark' href={LINKS.site} aria-label='Loxley home'>
          <Wordmark />
        </a>
        <nav className='site-nav' aria-label='Primary'>
          {NAV.map(([id, label]) => (
            <Fragment key={id}>{link(id, label)}</Fragment>
          ))}
        </nav>
        <ThemeToggle />

        <button
          className='navtoggle'
          aria-expanded={menuOpen}
          aria-controls='site-menu'
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className={`navtoggle__bars ${menuOpen ? 'is-open' : ''}`} aria-hidden='true'>
            <i />
            <i />
          </span>
        </button>
      </div>

      {menuOpen && (
        <>
          <div className='sitemenu__scrim' onClick={() => setMenuOpen(false)} aria-hidden='true' />
          <div className='sitemenu' id='site-menu'>
            {NAV.map(([id, label]) => (
              <a
                key={id}
                className={`sitemenu__link ${view === id ? 'is-on' : ''}`}
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault()
                  go(id)
                }}
              >
                {label}
                {view === id && <span className='sitemenu__here'>here</span>}
              </a>
            ))}
          </div>
        </>
      )}
    </header>
  )
}

function StatusNote({ children }: { children: ReactNode }) {
  return (
    <div className='emptystate'>
      <div className='emptystate__note'>
        <span className='emptystate__dot' aria-hidden='true' />
        <span>{children}</span>
      </div>
    </div>
  )
}

function SiteFooter() {
  return (
    <footer className='site-foot'>
      <div className='site-foot__inner'>
        <div className='site-foot__brand'>
          <div className='wordmark wordmark--foot'>
            <Wordmark variant='foot' />
          </div>
          <p className='site-foot__tag'>
            Infrastructure for confidential coordination between independent parties. An unreleased fork of The Interfold, targeting
            Robinhood Chain.
          </p>
        </div>
        <div className='site-foot__cols'>
          <div>
            <div className='site-foot__col-head'>Learn</div>
            <a href={LINKS.docs} target='_blank' rel='noreferrer'>
              Documentation
            </a>
            <a href={LINKS.architecture} target='_blank' rel='noreferrer'>
              Architecture
            </a>
            <a href={LINKS.crisp} target='_blank' rel='noreferrer'>
              CRISP
            </a>
          </div>
          <div>
            <div className='site-foot__col-head'>Project</div>
            <a href={LINKS.repo} target='_blank' rel='noreferrer'>
              Source
            </a>
          </div>
          {/* Upstream apart, en ook zo benoemd. Dit is het werk waar deze fork
              op leunt -- het onder "Project" zetten deed alsof het van ons was. */}
          <div>
            <div className='site-foot__col-head'>Upstream</div>
            <a href={LINKS.upstreamSite} target='_blank' rel='noreferrer'>
              The Interfold ↗
            </a>
            <a href={LINKS.upstreamBlog} target='_blank' rel='noreferrer'>
              Their blog ↗
            </a>
          </div>
        </div>
      </div>
      <div className='site-foot__rule'>
        <span>© 2026 Loxley · Built in the open</span>
        <a className='mono' href={explorerAddress(CONTRACTS.Loxley)} target='_blank' rel='noreferrer'>
          Loxley on Sepolia ↗
        </a>
      </div>
    </footer>
  )
}

// Fixed presentation density (the live tweak panel was removed).
const DENSITY = 'comfortable'

// Linkable views. Anything else in the hash falls back to the inspector, so a
// stale or hand-typed fragment can never render a blank page.
const VIEWS = ['inspector', 'crisp', 'operator', 'audit']

function viewFromHash(): string {
  const id = globalThis.location?.hash.replace(/^#/, '') ?? ''
  return VIEWS.includes(id) ? id : 'inspector'
}

// Derive the poll-card state from the UI stage + ballot count. Specifically,
// when the input window has closed (uiStageIdx >= 4) but no ballots ever arrived,
// the committee isn't actually tallying anything — surface that as a distinct
// "idle" state instead of falsely claiming a tally is in progress.
const pollStateForStage = (uiStageIdx: number, ballotCount: number): string => {
  if (uiStageIdx >= 6) return 'published'
  if (uiStageIdx >= 4) return ballotCount === 0 ? 'idle' : 'computing'
  return 'open'
}

// Synthetic poll used only for the "Watch the lifecycle" demo when nothing is live.
const DEMO_POLL: Poll = {
  id: 'Sample',
  question: 'A sample CRISP poll — watch how an encrypted poll moves through its lifecycle.',
  context: 'This is an interactive demonstration, not a live poll.',
  opened: '—',
  closes: '—',
  closesTs: 0,
  ballotCount: 0,
}

export default function App() {
  // View (tab) + demo poll state. These are the only values that change at
  // runtime; everything else is fixed (accent comes from the CSS :root mint).
  // The view is mirrored into the URL hash so each tab is linkable from
  // outside — the docs site points at `#operator` for the ciphernode guide.
  const [view, setView] = useState(viewFromHash)
  const [pollState, setPollState] = useState('open')
  const [stageIdx, setStageIdx] = useState(3)

  const [nowMs, setNowMs] = useState(() => Date.now())
  const [liveMode, setLiveMode] = useState(false)
  // Demo autoplay step, persisted so pausing/resuming continues where it left off.
  const liveStepRef = useRef(0)

  // ─── On-chain data (Sepolia) ──────────────────────────────────────────────
  // CRISP tab: only CRISP-program polls. Inspector tab: every E3 on the network.
  const crispPolls = useCrispPolls()
  const allE3s = useAllE3s()
  const recentBallots = useRecentBallots()

  // Inspector keeps its own selection — track which id is currently selected.
  const [inspectorIdStr, setInspectorIdStr] = useState<string | null>(null)
  const selectedInspectorId = useMemo(() => {
    if (!allE3s.data || allE3s.data.length === 0) return null
    if (inspectorIdStr) {
      const match = allE3s.data.find((e) => formatE3Id(e.id) === inspectorIdStr)
      if (match) return match.id
    }
    return allE3s.data[0].id
  }, [allE3s.data, inspectorIdStr])
  const inspectorDetail = useE3Details(selectedInspectorId)

  // Detail cache for history verdicts (the inspector-selected E3, if any).
  const detailsCache = useMemo(() => {
    const m = new Map<string, E3FullDetails>()
    if (inspectorDetail.data) m.set(inspectorDetail.data.id.toString(), inspectorDetail.data)
    return m
  }, [inspectorDetail.data])

  // CRISP tab state: split into currently-active polls (featured) and the rest
  // (archived). Card data comes straight from the list summary — no per-poll fetch.
  const crispReady = crispPolls.status === 'ready'
  const polls = useMemo(() => crispPolls.data ?? [], [crispPolls.data])
  // `nowMs` updates each second so isE3Active re-evaluates and polls move from
  // active → past as their windows close, rather than waiting for the next 15s
  // on-chain refresh.
  const activePolls = useMemo<E3Summary[]>(
    () => polls.filter((p) => isE3Active(p.stage, p.inputWindow[1], { e3Program: p.e3Program, ballotCount: p.ballotCount, nowMs })),
    [polls, nowMs],
  )
  const pastPolls = useMemo<E3Summary[]>(
    () => polls.filter((p) => !isE3Active(p.stage, p.inputWindow[1], { e3Program: p.e3Program, ballotCount: p.ballotCount, nowMs })),
    [polls, nowMs],
  )
  const liveHistory = useMemo(() => adaptHistoryEntries(pastPolls, detailsCache), [pastPolls, detailsCache])

  // Inspector tab state.
  const inspectorReady = allE3s.status === 'ready'
  const hasE3s = (allE3s.data?.length ?? 0) > 0
  const inspectorList = useMemo(() => adaptInspectorE3List(allE3s.data ?? []), [allE3s.data])
  const inspectorE3 = useMemo(() => adaptInspectorDetail(inspectorDetail.data), [inspectorDetail.data])

  const setStage = (i: number) => {
    setStageIdx(i)
    if (i >= 6) setPollState('published')
    else if (i >= 4) setPollState('computing')
    else setPollState('open')
  }

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Keep the view in sync with back/forward navigation and inbound deep links.
  useEffect(() => {
    const onHashChange = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = (id: string) => {
    setView(id)
    // Writing the hash fires `hashchange`, which is a no-op here since the
    // state already matches — it just keeps the URL shareable.
    if (viewFromHash() !== id) window.location.hash = id
  }

  useEffect(() => {
    if (!liveMode) return undefined
    const program = [
      { state: 'open', stage: 0, hold: 2200 },
      { state: 'open', stage: 1, hold: 2200 },
      { state: 'open', stage: 2, hold: 2400 },
      { state: 'open', stage: 3, hold: 4600 },
      { state: 'computing', stage: 4, hold: 2800 },
      { state: 'computing', stage: 5, hold: 2400 },
      { state: 'published', stage: 6, hold: 4000 },
    ]
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const advance = () => {
      if (cancelled) return
      const i = liveStepRef.current
      if (i >= program.length) {
        // Completed one full lifecycle — stop instead of looping.
        liveStepRef.current = 0
        setLiveMode(false)
        return
      }
      const step = program[i]
      setPollState(step.state)
      setStageIdx(step.stage)
      liveStepRef.current = i + 1
      timer = setTimeout(advance, step.hold)
    }
    advance()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [liveMode])

  // Demo card's current stage, reconciled from the demo's pollState/stageIdx.
  const demoStage = (() => {
    if (pollState === 'published') return 6
    if (pollState === 'computing') return Math.max(4, Math.min(5, stageIdx))
    return Math.min(stageIdx, 3)
  })()

  return (
    <div className={`page page--${DENSITY}`}>
      <Header density={DENSITY} view={view} onNav={navigate} />
      {view === 'audit' ? (
        <>
          <Hero
            size='compact'
            eyebrow='Verifier audit'
            title={
              <>
                Publicly checkable, <em>checked</em>.
              </>
            }
            lede='Every deployment claims its proofs are verifiable on chain. This reads the three verifier slots directly and reports what is in them — upstream Interfold’s networks, since Loxley has none of its own yet.'
          />
          <main className='main'>
            <VerifierAudit />
          </main>
        </>
      ) : view === 'operator' ? (
        <>
          <Hero
            size='compact'
            eyebrow='Ciphernode operators'
            title={
              <>
                Hold a share of every <em>secret</em>.
              </>
            }
            lede={
              <>
                Ciphernodes are drawn into committees by sortition and hold key shares for computations they can never read on their own.
                Everything below walks the on-chain setup step by step, against the live{' '}
                <a className='link-inline' href={explorerAddress(CONTRACTS.BondingRegistry)} target='_blank' rel='noreferrer'>
                  bonding registry
                </a>
                .
              </>
            }
          />
          <main className='main'>
            <Operator />
          </main>
        </>
      ) : view === 'inspector' ? (
        <>
          {/* De hero staat alleen op de inspector: dat is de landingsweergave.
              De cijfers zijn dezelfde als in de footer-strip -- echte waarden,
              geen opgeklopte. */}
          <Hero
            eyebrow='Encrypted execution environments · chain 4663'
            title={
              <>
                Private inputs.
                <br />
                <em>Public outcomes.</em>
              </>
            }
            lede='Loxley runs computations that nobody — not the requester, not a ciphernode, not whoever operates the network — can read the inputs of. What comes out is a single verified result, and a proof that it was produced correctly.'
            stats={[
              { label: 'Active E3s', value: String(activePolls.length) },
              { label: 'Encrypted ballots, 24h', value: recentBallots.toLocaleString() },
              { label: 'CRISP polls, all-time', value: polls.length.toLocaleString() },
            ]}
          />
          <main className='main'>
            {allE3s.status === 'error' ? (
              <div className='inspector'>
                <StatusNote>Couldn't load E3s from Sepolia. Retrying automatically…</StatusNote>
              </div>
            ) : !inspectorReady ? (
              <div className='inspector'>
                <Loader label='Loading E3s' sub='Reading from Sepolia…' />
              </div>
            ) : !hasE3s ? (
              <div className='inspector'>
                <StatusNote>No E3s on the network yet. They will appear here once one is requested on-chain.</StatusNote>
                {/* Een lege lijst is de eerste indruk die de meeste bezoekers
                  krijgen. In plaats van doodlopen: laten zien wat er straks in
                  die lijst verschijnt en waarom het bijzonder is. */}
                <Reveal band='plain'>
                  <Lifecycle />
                </Reveal>
                <Reveal band='sunk'>
                  <TrustLadder />
                </Reveal>
                {/* Het enige stuk dat je bedient. Staat na de ladder: die legt
                    uit dat er nog vertrouwen overblijft, dit laat voelen waarom
                    dat restje zo klein is. */}
                <Reveal band='plain'>
                  <KeyShares />
                </Reveal>
              </div>
            ) : (
              <Inspector
                e3List={inspectorList}
                e3={inspectorE3}
                selectedId={selectedInspectorId ? formatE3Id(selectedInspectorId) : undefined}
                onSelect={(id) => setInspectorIdStr(id)}
                loading={inspectorDetail.status === 'loading'}
                error={inspectorDetail.status === 'error' ? inspectorDetail.error : null}
              />
            )}
          </main>
        </>
      ) : (
        <>
          <Hero
            size='compact'
            eyebrow={<>CRISP · live, public poll</>}
            title={
              <>
                A poll nobody can <em>read</em>.
              </>
            }
            lede='Ballots are encrypted on each voter’s device, tallied without ever being decrypted, and only the final result is revealed. Below is the lifecycle as it happens, and the archive of every poll that came before.'
          />
          <main className='main'>
            {crispPolls.status === 'error' ? (
              <StatusNote>Couldn't load CRISP polls from Sepolia. Retrying automatically…</StatusNote>
            ) : !crispReady ? (
              <Loader label='Loading CRISP polls' sub='Reading from Sepolia…' />
            ) : activePolls.length > 0 ? (
              <>
                {activePolls.map((s) => {
                  const poll = adaptPoll(s)
                  const stageIdx = solidityStageToUiIdx(s.stage, s.inputWindow)
                  return (
                    <Fragment key={s.id.toString()}>
                      <PollCard
                        poll={poll}
                        pollState={pollStateForStage(stageIdx, s.ballotCount)}
                        currentStageIdx={stageIdx}
                        ballotCount={s.ballotCount}
                        onNavigate={navigate}
                      />
                      <Timeline stages={STAGES} currentStageIdx={stageIdx} pollId={poll.id} density={DENSITY} />
                    </Fragment>
                  )
                })}
              </>
            ) : (
              // No live polls — offer the lifecycle as an interactive demo.
              <>
                <StatusNote>No live CRISP polls right now. Here's how an encrypted poll moves through its lifecycle:</StatusNote>
                <PollCard
                  poll={DEMO_POLL}
                  pollState={pollState}
                  currentStageIdx={demoStage}
                  liveMode={liveMode}
                  onToggleLive={() => setLiveMode((v) => !v)}
                  ballotCount={0}
                  onNavigate={navigate}
                />
                <Timeline
                  stages={STAGES}
                  currentStageIdx={demoStage}
                  pollId='demo'
                  density={DENSITY}
                  onStageClick={liveMode ? undefined : setStage}
                />
              </>
            )}

            {/* Waarom je een poll uberhaupt zou versleutelen. Staat na de
                lopende poll: eerst zien wat het is, dan waarom het anders is. */}
            <Reveal band='sunk'>
              <BallotPrivacy />
            </Reveal>

            {liveHistory.length > 0 && <History entries={liveHistory} onNavigate={navigate} />}
          </main>
        </>
      )}

      <Pulse
        data={{
          activeNow: activePolls.length,
          ballots24h: recentBallots,
          pollsAllTime: polls.length,
        }}
      />
      <SiteFooter />
    </div>
  )
}
