// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

import { GitHubLogo } from './SocialIcons'
import { ReactElement } from 'react'

interface SocialLinksProps {
  name: string
  icon: ReactElement
  url: string
}

// Alleen kanalen die bestaan en van ons zijn. Hier stonden x.com/theloxley --
// door de hernoemslag verzonnen, geeft 404 -- en een Telegram-groep die wel
// bestaat maar niet de onze is. Een dode link is vervelend; een link naar
// andermans kanaal onder je eigen merk is erger.
export const socialLinks: SocialLinksProps[] = [
  {
    name: 'github',
    icon: <GitHubLogo size={24} />,
    url: 'https://github.com/thecryptodog12-rgb/loxley',
  },
]
