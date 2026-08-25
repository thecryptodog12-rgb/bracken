// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// Theme control: system / light / dark.
//
// "System" is the default and a real option, not a fallback -- someone who has
// already told their OS what they want should not have to tell us again. Only
// an explicit choice writes [data-theme], which is what the CSS guards on.

import { useEffect, useState } from 'react'

type Theme = 'system' | 'light' | 'dark'

const KEY = 'bracken.theme'

const read = (): Theme => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

const apply = (t: Theme) => {
  const root = document.documentElement
  if (t === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
}

// Een icoon per stand. Systeem is een halfgevulde cirkel: de pagina volgt
// iets buiten zichzelf.
const ICON: Record<Theme, JSX.Element> = {
  system: (
    <>
      <circle cx='12' cy='12' r='8.4' stroke='currentColor' strokeWidth='1.6' />
      <path d='M12 3.6a8.4 8.4 0 0 0 0 16.8Z' fill='currentColor' />
    </>
  ),
  light: (
    <>
      <circle cx='12' cy='12' r='4' stroke='currentColor' strokeWidth='1.6' />
      <path
        d='M12 3.2V1.6M12 22.4v-1.6M20.8 12h1.6M1.6 12h1.6M18.2 5.8l1.1-1.1M4.7 19.3l1.1-1.1M5.8 5.8 4.7 4.7M19.3 19.3l-1.1-1.1'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinecap='round'
      />
    </>
  ),
  dark: (
    <path d='M20.5 14.2A8.7 8.7 0 0 1 9.8 3.5a8.9 8.9 0 1 0 10.7 10.7Z' stroke='currentColor' strokeWidth='1.6' strokeLinejoin='round' />
  ),
}

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<Theme, string> = { system: 'Theme: follows your system', light: 'Theme: light', dark: 'Theme: dark' }

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(read)

  useEffect(() => {
    apply(theme)
    try {
      if (theme === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, theme)
    } catch {
      /* private mode: the choice just doesn't survive a reload */
    }
  }, [theme])

  return (
    <button
      className='themetoggle'
      onClick={() => setTheme(NEXT[theme])}
      title={`${LABEL[theme]} — click to switch`}
      aria-label={`${LABEL[theme]}. Switch to ${NEXT[theme]}.`}
    >
      <svg viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        {ICON[theme]}
      </svg>
    </button>
  )
}
