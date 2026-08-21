// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// The verifier audit.
//
// The protocol sells public verifiability; nobody ships a public verifier. This
// is the smallest honest version of one: point it at a deployment and it tells
// you which contract sits in each proof slot and whether that contract is big
// enough to be doing any work.
//
// It reads upstream Interfold's live deployments, because Loxley has none. That
// is stated on screen rather than glossed — a tool whose whole value is candour
// cannot start by being vague about whose chain it is looking at.

import { useCallback, useEffect, useState } from 'react'
import { NETWORKS, auditNetwork, type AuditResult, type SlotResult, type Verdict } from './lib/verifierAudit'

const VERDICT_LABEL: Record<Verdict, string> = {
  empty: 'Nothing here',
  stub: 'Stub',
  present: 'Contract present',
  unreadable: 'Could not read',
}

function Slot({ r, explorer }: { r: SlotResult; explorer: string }) {
  return (
    <div className={`vaudit__slot vaudit__slot--${r.verdict}`}>
      <div className='vaudit__slot-head'>
        <h4>{r.label}</h4>
        <span className='vaudit__badge'>{VERDICT_LABEL[r.verdict]}</span>
      </div>
      <p className='vaudit__covers'>{r.covers}</p>
      <p className='vaudit__detail'>{r.detail}</p>
      {r.address && (
        <a className='vaudit__addr mono' href={`${explorer}/address/${r.address}`} target='_blank' rel='noreferrer'>
          {r.address}
        </a>
      )}
    </div>
  )
}

export default function VerifierAudit() {
  const [results, setResults] = useState<AuditResult[]>([])
  const [loading, setLoading] = useState(true)

  const run = useCallback(async () => {
    setLoading(true)
    const out = await Promise.all(NETWORKS.map((n) => auditNetwork(n)))
    setResults(out)
    setLoading(false)
  }, [])

  useEffect(() => {
    void run()
  }, [run])

  return (
    <section className='vaudit'>
      <div className='vaudit__head'>
        <span className='section__eyebrow'>Verifier audit</span>
        <h2 className='vaudit__title'>
          What is <em>actually</em> being checked.
        </h2>
        <p className='vaudit__lede'>
          Three proofs stand between “a committee said so” and “anyone can confirm it”. This reads each slot directly off the chain and
          reports what it finds — including when the answer is that nothing is being checked at all.
        </p>
        <button className='btn' onClick={() => void run()} disabled={loading}>
          {loading ? 'Reading…' : 'Read again'}
        </button>
      </div>

      <div className='vaudit__nets'>
        {results.map((res) => (
          <article key={res.target.key} className='vaudit__net'>
            <header className='vaudit__net-head'>
              <div>
                <h3>{res.target.label}</h3>
                <p className='vaudit__net-note'>{res.target.note}</p>
              </div>
              <div className='vaudit__net-meta mono'>{res.blockNumber !== null ? `block ${res.blockNumber.toString()}` : '—'}</div>
            </header>

            {res.error ? (
              <p className='vaudit__err'>
                Could not reach this network: {res.error}. That is a failure of this tool, not a finding about the deployment.
              </p>
            ) : (
              <div className='vaudit__slots'>
                {res.slots.map((s) => (
                  <Slot key={s.slot} r={s} explorer={res.target.explorer} />
                ))}
              </div>
            )}
          </article>
        ))}
        {loading && results.length === 0 && <p className='vaudit__err'>Reading three verifier slots on two networks…</p>}
      </div>

      <div className='vaudit__foot'>
        <h4>What this does and does not prove</h4>
        <p>
          The test is the BN254 <em>base-field</em> modulus, because that is what pairing arithmetic needs — and pairing arithmetic is what
          verifying a proof actually costs. The scalar modulus is not enough: a wrapper carries that to range-check its inputs while
          delegating, or not verifying at all. Wrappers are followed through their <code>circuitVerifier()</code>, and proxies through the
          EIP-1967 slot, so neither is mistaken for a stub.
        </p>
        <p>
          The reverse does not follow. Field constants mean real curve arithmetic is happening; they do not tell you the verifier checks the
          circuit you think it does, that its verification key matches, or that the parameters are sound. And a verifier over some other
          curve would show up here as a stub when it is not one. This narrows the question honestly; it does not close it — and a tool that
          claimed to would be asking for exactly the kind of trust this protocol exists to remove.
        </p>
      </div>
    </section>
  )
}
