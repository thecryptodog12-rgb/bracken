// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

// Bewijs dat @loxley/diagrams' stadia nog gelijk zijn aan het contract.
//
// Het diagrammen-pakket houdt de nummers zelf bij zodat het geen viem en geen
// typechain hoeft binnen te trekken. De prijs daarvan zou "met de hand
// synchroon houden" zijn -- behalve dat dit bestand het afdwingt: wijkt de
// enum af, dan compileert het dashboard niet meer.

import { E3_STAGES } from '@loxley/diagrams'
import { E3Stage } from './lib/chain'

type Assert<T extends true> = T
type Eq<A, B> = A extends B ? (B extends A ? true : false) : false

export type _StagesMatch = [
  Assert<Eq<typeof E3_STAGES.None, E3Stage.None>>,
  Assert<Eq<typeof E3_STAGES.Requested, E3Stage.Requested>>,
  Assert<Eq<typeof E3_STAGES.CommitteeFinalized, E3Stage.CommitteeFinalized>>,
  Assert<Eq<typeof E3_STAGES.KeyPublished, E3Stage.KeyPublished>>,
  Assert<Eq<typeof E3_STAGES.CiphertextReady, E3Stage.CiphertextReady>>,
  Assert<Eq<typeof E3_STAGES.Complete, E3Stage.Complete>>,
  Assert<Eq<typeof E3_STAGES.Failed, E3Stage.Failed>>,
]
