// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LoxleyTicketToken", (m) => {
  const baseToken = m.getParameter("baseToken");
  const registry = m.getParameter("registry");
  const owner = m.getParameter("owner");

  const loxleyTicketToken = m.contract("LoxleyTicketToken", [
    baseToken,
    registry,
    owner,
  ]);

  return { loxleyTicketToken };
}) as any;
