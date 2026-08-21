// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextra = require('nextra')

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.jsx',
  latex: true,
})

module.exports = withNextra({
  // Statische export: alle 49 pagina's zijn al static, en zonder server-kant
  // hoeft Vercel geen framework te detecteren -- wat in deze pnpm-monorepo
  // juist het probleem was. `images.unoptimized` is verplicht in export-modus.
  output: 'export',
  images: { unoptimized: true },
  // @loxley/diagrams is TypeScript-bron uit de workspace; zonder dit laat Next
  // hem ongemoeid door webpack gaan en struikelt die over de type-syntax.
  transpilePackages: ['@loxley/diagrams'],
  webpack: (config) => {
    // Nextra v2 skips addContextDependency in production, so webpack reuses
    // cached MDX compilations when only _meta.json changes. Disabling the
    // cache forces a full recompile on every build.
    config.cache = false
    return config
  },
})
