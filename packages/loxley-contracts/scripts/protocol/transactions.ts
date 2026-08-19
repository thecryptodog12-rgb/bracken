// SPDX-License-Identifier: LGPL-3.0-only
import { appendBondingTxs, bondingUpgradeTx } from "./tx/bonding";
import { appendLoxleyTxs } from "./tx/loxley";
import { appendRegistryTxs } from "./tx/registry";
import { appendSlashingTxs, appendTicketTxs } from "./tx/tokenAndSlashing";
import type {
  ProtocolConfigFile,
  ProtocolContracts,
  ProtocolInterfaces,
  SafeTransaction,
} from "./types";

export function buildSafeTransactions(
  config: ProtocolConfigFile,
  contracts: ProtocolContracts,
  interfaces: ProtocolInterfaces,
): SafeTransaction[] {
  const txs = [bondingUpgradeTx(config, contracts, interfaces)];

  appendLoxleyTxs(txs, config, contracts, interfaces);
  appendRegistryTxs(txs, config, contracts, interfaces);
  appendTicketTxs(txs, config, contracts, interfaces);
  appendSlashingTxs(txs, config, contracts, interfaces);
  appendBondingTxs(txs, config, contracts, interfaces);

  return txs;
}
