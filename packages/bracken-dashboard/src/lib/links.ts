// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// Waar dit dashboard naartoe linkt.
//
// Alle externe bestemmingen op een plek, zodat er niet opnieuw een verzonnen of
// geleende URL tussen kan glippen -- dat is hier twee keer eerder gebeurd. Elke
// URL is instelbaar en valt terug op de lokale dev-poort, zodat een lokale
// checkout ook lokaal blijft.

const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>
const envStr = (key: string, fallback: string): string => {
  const v = env[key]
  return v && v.trim() !== '' ? v.trim() : fallback
}

const DOCS = envStr('VITE_DOCS_URL', 'http://localhost:3000').replace(/\/$/, '')
const SITE = envStr('VITE_SITE_URL', 'http://localhost:5174').replace(/\/$/, '')

export const LINKS = {
  // De voordeur. Het dashboard en de docs bedienen wie al binnen is; geen van
  // beide vertelt een vreemde wat dit is. Het merk hoort daarheen terug te
  // wijzen, zoals overal -- anders is de begin-page alleen te vinden door de
  // URL te kennen, en dat is geen ingang maar een geheim.
  site: SITE,

  docs: `${DOCS}/introduction`,
  architecture: `${DOCS}/architecture-overview`,
  crisp: `${DOCS}/CRISP/introduction`,
  repo: envStr('VITE_REPO_URL', 'https://github.com/thecryptodog12-rgb/bracken'),

  explorer: 'https://explorer.mainnet.chain.robinhood.com',
} as const

export function explorerAddress(address: string): string {
  return `${LINKS.explorer}/address/${address}`
}

export function explorerTx(txHash: string): string {
  return `${LINKS.explorer}/tx/${txHash}`
}
