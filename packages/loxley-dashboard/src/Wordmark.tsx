// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// Loxley wordmark: a hood mark plus the name set as live text.
//
// The mark is a cowl silhouette with the face left empty -- the identity is
// concealed, the silhouette is not. That is the protocol in one glyph: inputs
// stay private, the outcome is public and verifiable.
//
// Deliberately NOT an image mask like the old asset was: real text inherits the
// serif token, stays selectable and accessible, and scales without a second file
// to keep in sync.

export function Mark({ className = '' }: { className?: string }) {
  return (
    <svg className={`mark ${className}`} viewBox='0 0 24 24' fill='none' aria-hidden='true' focusable='false'>
      {/* cowl: shoulders up over a raised hood */}
      <path
        d='M12 1.6c-4.9 0-8.6 3.9-8.6 9.2v9.4c0 1 .8 1.8 1.8 1.8h3.4v-8.2a3.4 3.4 0 0 1 6.8 0V22h3.4c1 0 1.8-.8 1.8-1.8v-9.4c0-5.3-3.7-9.2-8.6-9.2Z'
        fill='currentColor'
      />
      {/* the shadowed face: an absence, not a feature */}
      <path
        d='M12 5.4c-3 0-5.2 2.4-5.2 5.6 0 1.5.5 2.8 1.4 3.8V13a3.8 3.8 0 0 1 7.6 0v1.8c.9-1 1.4-2.3 1.4-3.8 0-3.2-2.2-5.6-5.2-5.6Z'
        fill='currentColor'
        opacity='0.28'
      />
    </svg>
  )
}

export function Wordmark({ variant }: { variant?: 'foot' }) {
  return (
    <>
      <Mark />
      <span className='wordmark__name'>Loxley</span>
      {variant === 'foot' ? null : <span className='wordmark__chain'>4663</span>}
    </>
  )
}
