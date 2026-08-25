// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("BrackenTicketToken", (m) => {
  const baseToken = m.getParameter("baseToken");
  const registry = m.getParameter("registry");
  const owner = m.getParameter("owner");

  const brackenTicketToken = m.contract("BrackenTicketToken", [
    baseToken,
    registry,
    owner,
  ]);

  return { brackenTicketToken };
}) as any;
