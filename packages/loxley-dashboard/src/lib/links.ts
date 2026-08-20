// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// Waar dit dashboard naartoe linkt.
//
// De rebrand liet hier twee fouten achter. De "Docs", "Blog" en "Website"
// knoppen stuurden bezoekers naar theinterfold.com -- ons eigen product wees
// dus naar dat van upstream. En LINKS.repo was via de hernoeming
// github.com/gnosisguild/loxley geworden, wat 404 geeft: dat pad heeft nooit
// bestaan.
//
// Loxley's docs zijn nog nergens gedeployed, dus DOCS_URL is instelbaar en valt
// terug op de lokale dev-server. Wie dit publiceert zet VITE_DOCS_URL; wie het
// lokaal draait heeft de docs op :3000 en komt daar dus ook uit.

const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>
const envStr = (key: string, fallback: string): string => {
  const v = env[key]
  return v && v.trim() !== '' ? v.trim() : fallback
}

const DOCS = envStr('VITE_DOCS_URL', 'http://localhost:3000').replace(/\/$/, '')

export const LINKS = {
  docs: `${DOCS}/introduction`,
  architecture: `${DOCS}/architecture-overview`,
  crisp: `${DOCS}/CRISP/introduction`,
  repo: envStr('VITE_REPO_URL', 'https://github.com/thecryptodog12-rgb/interfold'),

  // Upstream. Bewust apart gehouden en in de UI ook als zodanig gelabeld --
  // dit is andermans werk waar deze fork op leunt, geen eigen kanaal.
  upstreamSite: 'https://theinterfold.com/',
  upstreamBlog: 'https://blog.theinterfold.com/',

  explorer: 'https://sepolia.etherscan.io',
} as const

export function explorerAddress(address: string): string {
  return `${LINKS.explorer}/address/${address}`
}

export function explorerTx(txHash: string): string {
  return `${LINKS.explorer}/tx/${txHash}`
}
