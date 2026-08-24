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
// So this page does two things the others do not. It says what Loxley does in
// one sentence a non-cryptographer can hold, and it states its own status
// plainly — nothing deployed, no token, no operator set — near the top rather
// than in a footnote. A project whose entire pitch is verifiability cannot open
// by being vague about itself.

import { Canopy, Lifecycle, TrustLadder } from '@loxley/diagrams'
import Reveal from './Reveal'
import ThemeToggle from './ThemeToggle'
import { Wordmark } from './Wordmark'

const DOCS = 'https://loxley-docs-solplay.vercel.app/introduction'
const DASHBOARD = 'https://loxley-dashboard-solplay.vercel.app'
const REPO = 'https://github.com/thecryptodog12-rgb/loxley'

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
          <a className='wordmark' href='/' aria-label='Loxley home'>
            <Wordmark />
          </a>
          <nav className='nav' aria-label='Primary'>
            <a href={DOCS}>Docs</a>
            <a href={DASHBOARD}>Dashboard</a>
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
            Loxley runs computations on data that nobody involved is able to read — not the person who asked for it, not the operators
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
            Loxley targets Robinhood Chain (chain 4663). <strong>Nothing is deployed yet.</strong> The protocol runs end to end on a local
            network — sortition, distributed key generation, threshold decryption, a plaintext published on chain — and no contract exists
            on a public one. There is no token, no sale, and no operator set. Everything on this page is checkable in{' '}
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
                  <a className='path__cta' href={p.href}>
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
              <h4>Loxley</h4>
              <a href={DOCS}>Documentation</a>
              <a href={DASHBOARD}>Dashboard</a>
              <a href={REPO}>Source</a>
            </div>
          </div>
        </div>
        <div className='foot__rule' />
        <div className='foot__base'>
          <span>© 2026 Loxley · LGPL-3.0 · built in the open</span>
          <span className='mono'>chain 4663</span>
        </div>
      </footer>
    </div>
  )
}
