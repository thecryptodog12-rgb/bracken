// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// Mirror of IBracken.E3Stage.
//
// Kept here rather than imported so this package stays free of viem, the
// contract typechain and the whole dashboard dependency chain -- the docs site
// should be able to render a diagram without any of that. The dashboard
// asserts at compile time that these numbers still equal the real enum, so
// "kept in sync by hand" is not a thing anyone has to remember.
export const E3_STAGES = {
  None: 0,
  Requested: 1,
  CommitteeFinalized: 2,
  KeyPublished: 3,
  CiphertextReady: 4,
  Complete: 5,
  Failed: 6,
} as const

export type E3StageValue = (typeof E3_STAGES)[keyof typeof E3_STAGES]
