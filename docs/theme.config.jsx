// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

import { Link, useConfig } from 'nextra-theme-docs'
import { useRouter } from 'next/router'
import Footer from './components/Footer'

// De begin-page. Deze docs zijn een statische export, dus dit wordt bij de
// build ingebakken; wie zelf publiceert zet NEXT_PUBLIC_SITE_URL.
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5174').replace(/\/$/, '')

// De repo. Stond eerder op twee namen die de hernoemslag had verzonnen en die
// allebei 404 gaven, waardoor "Edit this page" nergens heen leidde.
const REPO = 'https://github.com/thecryptodog12-rgb/bracken'

// Waar deze docs zelf staan. Stond hardgecodeerd op een vreemd domein in elke
// og:- en twitter:-tag, dus elke gedeelde link kondigde dat aan als de
// canonieke plek van onze pagina's.
const DOCS_URL = (process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.loxley-rh.com').replace(/\/$/, '')

export default {
  // Wijst naar buiten, naar de voordeur -- niet naar de docs-root, waar je al
  // bent. target='_self' omdat dit een echte navigatie is, geen zijstap.
  logo: (
    <Link href={SITE} target='_self' aria-label='Bracken'>
      {/* Inline i.p.v. <img src>: currentColor werkt niet binnen een img, dus
          een extern bestand kan niet meekleuren met light/dark. Het merk houdt
          zijn greenwood, de naam erft de tekstkleur van het thema. */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px' }}>
        <svg width='22' height='22' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
          <path
            d='M12 1.6c-4.9 0-8.6 3.9-8.6 9.2v9.4c0 1 .8 1.8 1.8 1.8h3.4v-8.2a3.4 3.4 0 0 1 6.8 0V22h3.4c1 0 1.8-.8 1.8-1.8v-9.4c0-5.3-3.7-9.2-8.6-9.2Z'
            fill='var(--lox-accent)'
          />
          <path
            d='M12 5.4c-3 0-5.2 2.4-5.2 5.6 0 1.5.5 2.8 1.4 3.8V13a3.8 3.8 0 0 1 7.6 0v1.8c.9-1 1.4-2.3 1.4-3.8 0-3.2-2.2-5.6-5.2-5.6Z'
            fill='var(--lox-accent)'
            fillOpacity='0.28'
          />
        </svg>
        <span
          style={{
            fontFamily: 'var(--lox-display)',
            fontSize: '22px',
            lineHeight: 1,
            letterSpacing: '-0.014em',
            color: 'var(--lox-ink)',
          }}
        >
          Bracken
        </span>
      </span>
    </Link>
  ),
  logoLink: false,

  banner: {
    key: 'bracken-live-2026-08',
    text: (
      <span>
        <strong>Bracken is live</strong> on Robinhood Chain. No operator set yet, and the registered E3 program enforces no application
        rules — see{' '}
        <a href='/deployments' style={{ textDecoration: 'underline' }}>
          Deployments
        </a>
        .
      </span>
    ),
  },

  project: {
    link: REPO,
  },
  docsRepositoryBase: `${REPO}/tree/main/docs`,
  darkMode: false,
  nextThemes: {
    defaultTheme: 'light',
  },
  primaryHue: 203,
  primarySaturation: 100,

  sidebar: {
    defaultMenuCollapseLevel: 1,
  },
  useNextSeoProps() {
    const { asPath } = useRouter()
    if (asPath !== '/') {
      return {
        titleTemplate: '%s - Bracken',
      }
    }
  },
  head: function useHead() {
    const {
      frontMatter: { title, description },
    } = useConfig()
    return (
      <>
        <title>{title ? title : 'Bracken'}</title>
        <meta name='title' content={title ? title : 'Bracken'} />
        <meta
          name='description'
          content={
            description
              ? `${description}`
              : 'An open-source protocol for Encrypted Execution Environments (E3) enabling a new class of secure applications.'
          }
        />

        <meta property='og:type' content='website' />
        <meta property='og:url' content={DOCS_URL} />
        <meta property='og:title' content={title ? title : 'Bracken'} />
        <meta
          property='og:description'
          content={
            description
              ? `${description}`
              : 'Infrastructure for confidential coordination powered by Encrypted Execution Environments (E3).'
          }
        />
        <meta property='og:image' content={`${DOCS_URL}/bracken-meta.jpg`} />

        <meta property='twitter:card' content='summary_large_image' />
        <meta property='twitter:url' content={DOCS_URL} />
        <meta property='twitter:title' content={title ? title : 'Bracken'} />
        <meta
          property='twitter:description'
          content={
            description
              ? `${description}`
              : 'Infrastructure for confidential coordination powered by Encrypted Execution Environments (E3).'
          }
        />
        <meta property='twitter:image' content='/bracken-meta.jpg' />

        {/* SVG eerst: dat is het enige icoon dat al vervangen is. De PNG's
            eronder zijn nog Interfold's beeldmerk en blijven staan als
            fallback tot ze opnieuw geexporteerd zijn. */}
        <link rel='icon' type='image/svg+xml' href='/favicon.svg' />
        <link rel='apple-touch-icon' sizes='180x180' href='/apple-touch-icon.png' />
        <link rel='icon' type='image/png' sizes='32x32' href='/favicon-32x32.png' />
        <link rel='icon' type='image/png' sizes='16x16' href='/favicon-16x16.png' />
        <link rel='manifest' href='/site.webmanifest' />
        <link rel='mask-icon' href='/safari-pinned-tab.svg' color='#1c5c3f' />
        <meta name='msapplication-TileColor' content='#1c5c3f' />
        <meta name='theme-color' content='#e9f4e6' media='(prefers-color-scheme: light)' />
        <meta name='theme-color' content='#0d1610' media='(prefers-color-scheme: dark)' />
      </>
    )
  },
  footer: {
    component: <Footer />,
  },
  // ... other theme options
}
