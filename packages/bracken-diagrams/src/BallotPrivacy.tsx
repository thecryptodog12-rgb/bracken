// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// Who can see your ballot.
//
// The CRISP page said "ballots are encrypted on each voter's device, tallied
// without ever being decrypted". True, and it slides straight past most people,
// because every polling tool on the internet claims something that sounds like
// that.
//
// The comparison is what lands. Same four parties, two systems, one column that
// is empty all the way down. Nothing here is a claim about a competitor — the
// left column is what any ordinary server-side poll can do by construction,
// including honest ones. That is the point: honesty is not the variable being
// removed, capability is.

type Row = { who: string; normal: string; crisp: string; crispSees: boolean }

const ROWS: Row[] = [
  {
    who: 'Whoever runs the poll',
    normal: 'Your exact vote, tied to your session',
    crisp: 'A ciphertext they hold no key to',
    crispSees: false,
  },
  {
    who: 'Anyone who gets the database',
    normal: 'Every vote, forever, including yours',
    crisp: 'The same ciphertexts. A dump is worth nothing on its own',
    crispSees: false,
  },
  {
    who: 'A single ciphernode',
    normal: 'n/a — there is only the server',
    crisp: 'One key share, which decrypts nothing alone',
    crispSees: false,
  },
  {
    who: 'Everyone, after the close',
    normal: 'Whatever the operator chooses to publish',
    crisp: 'The tally, with a proof it matches the ballots cast',
    crispSees: true,
  },
]

export default function BallotPrivacy() {
  return (
    <section className='lxd ballotpriv' aria-label='Who can see your ballot'>
      <div className='ballotpriv__head'>
        <span className='lxd-eyebrow'>Why encrypt a poll at all</span>
        <h2 className='ballotpriv__title'>
          One column stays <em>empty</em>.
        </h2>
        <p className='ballotpriv__lede'>
          The left side is not a badly built poll. It is what any server-side poll can do by construction, honest ones included — which is
          exactly why "we don&apos;t look" is a policy and not a guarantee.
        </p>
      </div>

      <div className='ballotpriv__table' role='table'>
        <div className='ballotpriv__row ballotpriv__row--head' role='row'>
          <span role='columnheader'>Can see</span>
          <span role='columnheader'>An ordinary online poll</span>
          <span role='columnheader' className='ballotpriv__ours'>
            CRISP on Bracken
          </span>
        </div>

        {ROWS.map((r) => (
          <div key={r.who} className='ballotpriv__row' role='row'>
            <span className='ballotpriv__who' role='rowheader'>
              {r.who}
            </span>
            <span className='ballotpriv__cell ballotpriv__cell--normal' role='cell'>
              <i className='ballotpriv__mark ballotpriv__mark--open' aria-hidden='true' />
              {r.normal}
            </span>
            <span className={`ballotpriv__cell ballotpriv__cell--crisp ${r.crispSees ? 'is-open' : ''}`} role='cell'>
              <i className={`ballotpriv__mark ${r.crispSees ? 'ballotpriv__mark--open' : 'ballotpriv__mark--sealed'}`} aria-hidden='true' />
              {r.crisp}
            </span>
          </div>
        ))}
      </div>

      <p className='ballotpriv__foot'>
        The last row is the one that makes it useful rather than merely private: the result is not just revealed, it arrives with a proof
        that it is the tally of the ballots actually cast. A system that hid everything and told you the answer would be asking for the same
        trust in a quieter voice.
      </p>
    </section>
  )
}
