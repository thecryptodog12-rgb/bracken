// SPDX-License-Identifier: LGPL-3.0-only
//
// Contracten verifiëren op Blockscout (keten 4663).
//
// `hardhat verify` komt hier niet doorheen: het v1-pad dat de plugin gebruikt
// geeft op deze instantie een 500. De v2-API neemt hetzelfde werk wel aan, en
// dat is ook het eerlijkere pad -- je stuurt de standard-json input die de
// compiler werkelijk gekregen heeft, in plaats van een platgeslagen bestand.
//
// Waarom dit ertoe doet: zonder verificatie is elk contract op de explorer een
// blok bytecode. Een protocol dat "publiek controleerbaar" belooft en waarvan
// niemand de broncode kan lezen, vraagt precies het vertrouwen dat het zegt weg
// te nemen.
//
// Gebruik:  node scripts/verify-blockscout.mjs [ContractNaam ...]
//           zonder argumenten: alles uit deployed_contracts.json onder robinhood

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..', 'packages', 'bracken-contracts')
const BASE = 'https://robinhoodchain.blockscout.com'
const STATE = path.join(ROOT, 'deployed_contracts.json')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alle artefacten indexeren op contractnaam -> {sourceName, buildInfo}. */
function indexArtifacts() {
  const byName = new Map()
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'build-info') continue
        walk(p)
      } else if (e.name.endsWith('.json') && !e.name.endsWith('.dbg.json')) {
        let a
        try {
          a = JSON.parse(fs.readFileSync(p, 'utf8'))
        } catch {
          continue
        }
        if (!a.contractName || !a.sourceName) continue
        // Hardhat 3 zet de verwijzing als buildInfoId in het artefact zelf; de
        // losse .dbg.json van versie 2 bestaat hier niet meer.
        const buildInfo = a.buildInfoId ? path.join(ROOT, 'artifacts', 'build-info', `${a.buildInfoId}.json`) : null
        byName.set(a.contractName, {
          sourceName: a.sourceName,
          inputSourceName: a.inputSourceName,
          linkReferences: a.linkReferences,
          buildInfo,
        })
      }
    }
  }
  walk(path.join(ROOT, 'artifacts'))
  return byName
}

/** Alleen de bestanden die dit contract werkelijk nodig heeft.
 *
 * De standard-input van hardhat bevat alles wat in één compilatie meeging --
 * voor sommige contracten 1,4 MB, en daar loopt deze Blockscout-instantie op
 * stuk met een 500. Het contract zelf heeft daar maar een fractie van nodig.
 *
 * De imports volgen betekent hier ook remappings toepassen: die zijn in solc
 * contextafhankelijk (`context:prefix=target`), dus de langste context die op
 * het importerende bestand past wint. Zonder dat komen @openzeppelin-paden
 * nergens uit. */
function closure(sources, remappings, entry) {
  const parsed = (remappings ?? []).map((r) => {
    const [ctxAndPrefix, target] = r.split('=')
    const i = ctxAndPrefix.indexOf(':')
    return i === -1
      ? { context: '', prefix: ctxAndPrefix, target }
      : { context: ctxAndPrefix.slice(0, i), prefix: ctxAndPrefix.slice(i + 1), target }
  })

  const normalise = (p) => {
    const out = []
    for (const seg of p.split('/')) {
      if (seg === '.' || seg === '') continue
      if (seg === '..') out.pop()
      else out.push(seg)
    }
    return out.join('/')
  }

  const resolve = (from, spec) => {
    if (spec.startsWith('.')) {
      return normalise(from.split('/').slice(0, -1).join('/') + '/' + spec)
    }
    // Langste passende context wint, daarbinnen de langste prefix.
    let best = null
    for (const r of parsed) {
      if (!from.startsWith(r.context)) continue
      if (!spec.startsWith(r.prefix)) continue
      if (
        !best ||
        r.context.length > best.context.length ||
        (r.context.length === best.context.length && r.prefix.length > best.prefix.length)
      ) {
        best = r
      }
    }
    return best ? normalise(best.target + spec.slice(best.prefix.length)) : spec
  }

  const seen = new Set()
  const queue = [entry]
  while (queue.length) {
    const key = queue.shift()
    if (seen.has(key) || !sources[key]) continue
    seen.add(key)
    const content = sources[key].content ?? ''
    for (const m of content.matchAll(/import[^;]*?["']([^"']+)["']/g)) {
      const target = resolve(key, m[1])
      if (!seen.has(target)) queue.push(target)
    }
  }
  const out = {}
  for (const k of seen) out[k] = sources[k]
  return out
}

async function addressState(address) {
  try {
    const r = await fetch(`${BASE}/api/v2/addresses/${address}`)
    const d = await r.json()
    return { verified: d.is_verified === true, indexed: d.is_contract === true }
  } catch {
    return { verified: false, indexed: false }
  }
}

async function isVerified(address) {
  return (await addressState(address)).verified
}

async function verifyOne(name, address, art) {
  if (!art?.buildInfo || !fs.existsSync(art.buildInfo)) {
    return { name, status: 'geen build-info' }
  }
  const st = await addressState(address)
  if (st.verified) return { name, status: 'was al geverifieerd' }
  // Blockscout weigert met een 500 en een HTML-pagina als het adres bij hen nog
  // niet als contract geindexeerd staat, ook al staat de code er op de keten.
  // Dat is hun indexer die achterloopt, geen fout in de indiening -- en het is
  // het melden waard in plaats van een lap HTML af te drukken.
  if (!st.indexed) return { name, status: 'nog niet geindexeerd door blockscout' }

  const bi = JSON.parse(fs.readFileSync(art.buildInfo, 'utf8'))
  const input = { ...bi.input }
  if (art.inputSourceName && input.sources[art.inputSourceName]) {
    input.sources = closure(input.sources, input.settings?.remappings, art.inputSourceName)
  }

  // Gelinkte libraries meegeven.
  //
  // Solidity laat een placeholder in de bytecode staan voor elke externe
  // library en die wordt pas bij het deployen ingevuld. De standard-input van
  // de compiler bevat die adressen dus niet, en zonder komt de bytecode die de
  // verifier zelf compileert nooit overeen met wat er op de keten staat --
  // precies de contracten met libraries (Bracken, BondingRegistry) bleven hangen.
  const libs = {}
  for (const [file, names] of Object.entries(art.linkReferences ?? {})) {
    for (const lib of Object.keys(names)) {
      const a = deployed[lib]
      if (!a) continue
      libs[file] ??= {}
      libs[file][lib] = a
    }
  }
  if (Object.keys(libs).length) {
    input.settings = { ...input.settings, libraries: libs }
  }
  const tmp = path.join(os.tmpdir(), `bracken-si-${name}.json`)
  fs.writeFileSync(tmp, JSON.stringify(input))

  // Via curl, niet via fetch.
  //
  // Node's FormData met een Blob levert op deze Blockscout-instantie een 500
  // met een HTML-foutpagina, terwijl exact dezelfde velden via curl -F wel
  // worden aangenomen. Het verschil zit in hoe de multipart-body gecodeerd
  // wordt; het is niet de moeite waard dat uit te vechten voor een script dat
  // een handvol keer draait.
  // Opnieuw proberen met oplopende pauze.
  //
  // Blockscout weigert met een 500 en een HTML-pagina zodra er te snel achter
  // elkaar wordt ingediend. Exact dezelfde payload die in een reeks van 27 een
  // 500 gaf, wordt los ingediend zonder morren aangenomen -- het is dus de
  // frequentie, niet de inhoud. Dat kostte een halve avond aan verkeerde
  // hypothesen (grootte, libraries, paden), dus het staat hier opgeschreven.
  let text = ''
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(4000 * attempt)
    text = submit(address, bi, art, name, tmp)
    if (text.includes('verification started')) break
  }
  fs.rmSync(tmp, { force: true })
  if (!text.includes('verification started')) {
    return { name, status: 'afgewezen', detail: text.replace(/\s+/g, ' ').slice(0, 100) }
  }

  // De dienst werkt asynchroon: geaccepteerd is nog niet geverifieerd.
  for (let i = 0; i < 20; i++) {
    await sleep(3000)
    if (await isVerified(address)) return { name, status: 'geverifieerd' }
  }
  return { name, status: 'ingediend, nog niet bevestigd' }
}

function submit(address, bi, art, name, tmp) {
  try {
    return execFileSync(
      'curl',
      [
        '-s',
        '--max-time',
        '120',
        '-X',
        'POST',
        `${BASE}/api/v2/smart-contracts/${address}/verification/via/standard-input`,
        '-F',
        `compiler_version=v${bi.solcLongVersion}`,
        // LGPL-3.0 in Blockscouts eigen nummering. De licentie die de bestanden
        // dragen, niet een die hier bedacht wordt.
        '-F',
        'license_type=gnu_lgpl_v3',
        '-F',
        `contract_name=${art.sourceName}:${name}`,
        // Constructor-argumenten staan in de deploy-transactie; Blockscout haalt
        // ze daar zelf uit, wat betrouwbaarder is dan ze hier hercoderen.
        '-F',
        'autodetect_constructor_args=true',
        '-F',
        `files[0]=@${tmp};type=application/json`,
      ],
      { encoding: 'utf8' },
    )
  } catch {
    return ''
  }
}

const state = JSON.parse(fs.readFileSync(STATE, 'utf8')).robinhood ?? {}
// Naam -> adres, zodat library-links ingevuld kunnen worden.
const deployed = Object.fromEntries(
  Object.entries(state)
    .map(([n, v]) => [n, typeof v === 'string' ? v : v?.address])
    .filter(([, a]) => a),
)
const arts = indexArtifacts()
const wanted = process.argv.slice(2)
const entries = Object.entries(state)
  .map(([n, v]) => [n, typeof v === 'string' ? v : v?.address])
  .filter(([n, a]) => a && (!wanted.length || wanted.includes(n)))

console.log(`${entries.length} contracten op keten 4663\n`)
const results = []
for (const [name, address] of entries) {
  process.stdout.write(`  ${name.padEnd(32)} `)
  const r = await verifyOne(name, address, arts.get(name))
  console.log(r.status + (r.detail ? ` -- ${r.detail}` : ''))
  results.push(r)
  await sleep(2000) // niet sneller indienen dan de dienst aankan
}

const ok = results.filter((r) => r.status === 'geverifieerd' || r.status === 'was al geverifieerd').length
console.log(`\n${ok}/${results.length} geverifieerd`)
