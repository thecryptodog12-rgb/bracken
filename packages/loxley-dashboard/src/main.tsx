// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import '@loxley/diagrams/diagrams.css'
// Type-only: dwingt af dat de diagram-stadia het contract nog volgen.
import type {} from './stageCheck'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
