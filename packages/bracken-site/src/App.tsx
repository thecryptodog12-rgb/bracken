// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// The front door.
//
// The docs explain the protocol to someone already convinced; the dashboard
// serves people who are already operating. Neither answers the first question a
// stranger has, which is what this is and whether it is real.
//
// So this page does two things the others do not. It says what Bracken does in
// one sentence a non-cryptographer can hold, and it states its own status
// plainly — what is deployed, and what is still missing (no independent
// operators, an E3 program that enforces nothing) — near the top rather than in
// a footnote. A project whose entire pitch is verifiability cannot open by being
// vague about itself, and "live" is exactly the moment that gets tempting.

import { Canopy, Lifecycle, TrustLadder } from '@bracken/diagrams'
import Reveal from './Reveal'
import ThemeToggle from './ThemeToggle'
import { Wordmark } from './Wordmark'

const DOCS_BASE = 'https://bracken-docs-solplay.vercel.app'
const DOCS = `${DOCS_BASE}/introduction`
const DASHBOARD = 'https://bracken-dashboard-solplay.vercel.app'
const REPO = 'https://github.com/thecryptodog12-rgb/bracken'

type Path = { eyebrow: string; title: string; body: string; cta: string; href: string; ready: boolean }

const PATHS: Path[] = [
  {
    eyebrow: 'Run a node',
    title: 'Hold a share of every secret',
    body: 'Ciphernodes are drawn into committees by sortition and hold key shares for computations they can never read alone. Bonded collateral, slashable duties, a share of the fees.',
    cta: 'Read the operator guide',
    href: `${DASHBOARD}/#operator`,
    ready: true,
  },
  {
    eyebrow: 'Build on it',
    title: 'Compute on data you are not allowed to see',
    body: 'Write the program, publish the request, let the network run it on encrypted inputs. Medical, financial, electoral — anywhere the data is the problem.',
    cta: 'Start with the docs',
    href: DOCS,
    ready: true,
  },
  {
    eyebrow: 'Check the claims',
    title: 'Read what is actually verified',
    body: 'Every deployment says its proofs are checkable on chain. The audit reads the three verifier slots directly and reports what it finds — including when the answer is nothing.',
    cta: 'Open the verifier audit',
    href: `${DASHBOARD}/#audit`,
    ready: true,
  },
]

export default function App() {
  return (
    <div className='page'>
      <header className='head'>
        <div className='head__inner'>
          <a className='wordmark' href='/' aria-label='Bracken home'>
            <Wordmark />
          </a>
          <nav className='nav' aria-label='Primary'>
            <a href={DOCS}>Docs</a>
            {/* Het dashboard is een aparte toepassing, geen pagina van deze
                site. Het opent daarom in een eigen tabblad: wie het aanklikt
                gaat er bewust heen en raakt deze pagina niet kwijt. */}
            <a href={DASHBOARD} target='_blank' rel='noreferrer' className='nav__app'>
              Dashboard <span aria-hidden='true'>↗</span>
            </a>
            <a href={REPO}>Source</a>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <section className='hero'>
        <Canopy height={520} density={30} />
        <div className='hero__inner'>
          <div className='hero__eyebrow'>
            <span className='hero__pulse' aria-hidden='true' />
            Encrypted execution environments · Robinhood Chain
          </div>
          <h1 className='hero__title'>
            Private inputs.
            <br />
            <em>Public outcomes.</em>
          </h1>
          <p className='hero__lede'>
            Bracken runs computations on data that nobody involved is able to read — not the person who asked for it, not the operators
            running the machines, not whoever controls the network. What comes out is one verified result and a proof that it was produced
            honestly.
          </p>
          <div className='hero__actions'>
            <a className='btn btn--primary' href={DOCS}>
              How it works
            </a>
            <a className='btn' href={`${DASHBOARD}/#audit`}>
              See what is verified
            </a>
          </div>
        </div>
      </section>

      {/* Vroeg, niet in een voetnoot. Wie verifieerbaarheid verkoopt kan niet
          vaag beginnen over zichzelf. */}
      <section className='status'>
        <div className='status__inner'>
          <span className='status__tag'>Where this stands</span>
          <p>
            Bracken targets Robinhood Chain (chain 4663). <strong>Nothing is deployed yet.</strong> The protocol runs end to end on a local
            network — sortition, distributed key generation, threshold decryption, a plaintext published on chain — and no contract exists
            on a public one. Everything on this page is checkable in{' '}
            <a href={REPO} target='_blank' rel='noreferrer'>
              the source
            </a>
            .
          </p>
        </div>
      </section>

      <main className='main'>
        <Reveal band='sunk'>
          <Lifecycle />
        </Reveal>

        <Reveal band='plain'>
          <TrustLadder />
        </Reveal>

        {/* Het dashboard krijgt een eigen doorklik in plaats van een link
            tussen de rest: aparte toepassing, eigen tabblad. Wat je daar
            aantreft -- een netwerk dat draait maar nog leeg is -- staat hier
            vóór de klik, niet pas erna. */}
        <Reveal band='plain'>
          <section className='appcard'>
            <div className='appcard__text'>
              <span className='eyebrow'>The dashboard</span>
              <h2>
                Watch the network <em>work</em>.
              </h2>
              <p>
                Every E3 in flight, every committee seat, every proof slot — on one screen, updating as the protocol runs. It is the view an
                operator keeps open on a second monitor.
              </p>
              <p className='appcard__note'>
                <strong>It reads chain 4663 directly.</strong> Right now that means empty panels: the contracts are deployed but no E3 has
                been requested and no ciphernode has bonded. An empty network is what an empty network looks like — the dashboard does not
                dress it up.
              </p>
              <a className='btn btn--primary' href={DASHBOARD} target='_blank' rel='noreferrer'>
                Open the dashboard <span aria-hidden='true'>↗</span>
              </a>
            </div>

            {/* Geen screenshot: een statische weergave van dezelfde panelen,
                zodat hij niet veroudert zodra het dashboard verandert. */}
            <div className='appcard__shot' aria-hidden='true'>
              <div className='shot__bar'>
                <span className='shot__brand'>BRACKEN</span>
                <span className='shot__stat'>chain 4663</span>
                <span className='shot__stat'>seated 3/7</span>
                <span className='shot__spacer' />
                <span className='shot__dot' />
                <span className='shot__stat'>live</span>
              </div>
              <div className='shot__grid'>
                <div className='shot__panel'>
                  <div className='shot__head'>E3 queue</div>
                  {[
                    ['#0042', 'key published', 'live'],
                    ['#0041', 'ciphertext', 'live'],
                    ['#0040', 'complete', 'ok'],
                    ['#0038', 'failed', 'bad'],
                  ].map(([id, st, k]) => (
                    <div className='shot__row' key={id}>
                      <span className={`shot__d is-${k}`} />
                      <span className='shot__id'>{id}</span>
                      <span className='shot__st'>{st}</span>
                    </div>
                  ))}
                </div>
                <div className='shot__panel'>
                  <div className='shot__head'>Event log</div>
                  {[
                    ['DKG', 'aggregate key published'],
                    ['PROOF', 'share_encryption 3/3'],
                    ['DECRYPT', 'plaintext on chain'],
                    ['SLASH', 'cn-07 missed duty'],
                  ].map(([t, x]) => (
                    <div className='shot__row' key={t + x}>
                      <span className='shot__tag'>{t}</span>
                      <span className='shot__st'>{x}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal band='sunk'>
          <section className='paths'>
            <div className='paths__head'>
              <span className='eyebrow'>Different roles, shared infrastructure</span>
              <h2>Three ways in.</h2>
            </div>
            <div className='paths__grid'>
              {PATHS.map((p) => (
                <article className='path' key={p.title}>
                  <span className='path__eyebrow'>{p.eyebrow}</span>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                  <a className='path__cta' href={p.href} target='_blank' rel='noreferrer'>
                    {p.cta} <span aria-hidden='true'>→</span>
                  </a>
                </article>
              ))}
            </div>
          </section>
        </Reveal>
      </main>

      <footer className='foot'>
        <div className='foot__inner'>
          <div className='foot__brand'>
            {/* De wrapper-klassen dragen de layout; Wordmark levert alleen merk
                en naam. Zonder .wordmark valt het merk als los blok uit. */}
            <div className='wordmark wordmark--foot'>
              <Wordmark variant='foot' />
            </div>
            <p>Infrastructure for confidential coordination between parties who do not have to trust each other.</p>
          </div>
          <div className='foot__cols'>
            <div>
              <h4>Bracken</h4>
              <a href={DOCS}>Documentation</a>
              <a href={DASHBOARD}>Dashboard</a>
              <a href={REPO}>Source</a>
            </div>
          </div>
        </div>
        <div className='foot__rule' />
        <div className='foot__base'>
          <span>© 2026 Bracken · LGPL-3.0 · built in the open</span>
          <span className='mono'>chain 4663</span>
        </div>
      </footer>
    </div>
  )
}
