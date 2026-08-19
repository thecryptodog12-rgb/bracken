// SPDX-License-Identifier: LGPL-3.0-only
import { proposeProxyUpgrade } from "./safeProxyUpgrade";

proposeProxyUpgrade("loxley").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
