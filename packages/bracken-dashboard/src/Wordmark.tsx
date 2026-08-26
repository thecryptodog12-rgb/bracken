// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// Bracken wordmark: een fiddlehead plus de naam als echte tekst.
//
// De fiddlehead is de opgerolde varenkrul voordat hij zich ontvouwt: een spiraal
// die van buiten naar binnen strakker wordt en in het midden dichtklapt. Dat is
// dit protocol in een vorm -- invoer die opgerold en gesloten binnenkomt, een
// uitkomst die zich opent.
//
// Drie halve slagen met krimpende straal, getekend als lijn in plaats van vlak:
// een spiraal die als vlak wordt gevuld wordt op 20 pixels een vlek, als lijn
// blijft hij leesbaar. De steel loopt door uit de buitenste slag, zodat het een
// blad is en geen los ornament.
//
// Bewust GEEN afbeelding: echte tekst erft het serif-token, blijft selecteerbaar
// en schaalt zonder een tweede bestand dat uit de pas kan lopen.

export function Mark({ className = '' }: { className?: string }) {
  return (
    <svg className={`mark ${className}`} viewBox='0 0 24 24' fill='none' aria-hidden='true' focusable='false'>
      {/* de steel, doorlopend uit de buitenste slag */}
      <path d='M5.5 11C4.1 14.2 4.8 18.6 8.2 22' stroke='currentColor' strokeWidth='1.9' strokeLinecap='round' opacity='0.55' />
      {/* de krul: drie halve slagen naar binnen. Meer slagen zag er op
          20 pixels uit als een vlek met een staart -- de gaten tussen de
          windingen zijn wat hem leesbaar houdt. */}
      <path
        d='M5.5 11A5.5 5.5 0 0 1 16.5 11A4 4 0 0 1 8.5 11A2.6 2.6 0 0 1 13.7 11'
        stroke='currentColor'
        strokeWidth='1.9'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}

export function Wordmark({ variant }: { variant?: 'foot' }) {
  return (
    <>
      <Mark />
      <span className='wordmark__name'>Bracken</span>
      {variant === 'foot' ? null : <span className='wordmark__chain'>4663</span>}
    </>
  )
}
