// SPDX-License-Identifier: LGPL-3.0-only
import { ethers as ethersLib } from "ethers";

import { ACTIVE_BFV_PARAM_SET } from "../../utils";
import { BFV_PARAMS } from "../constants";
import { safeTx } from "../safe";
import type {
  ProtocolConfigFile,
  ProtocolContracts,
  ProtocolInterfaces,
  SafeTransaction,
} from "../types";
import { encodeBfvParams, optionalAddress, pricingConfig } from "../values";

export function appendLoxleyTxs(
  txs: SafeTransaction[],
  config: ProtocolConfigFile,
  c: ProtocolContracts,
  i: ProtocolInterfaces,
) {
  txs.push(
    safeTx(
      c.loxley,
      i.loxley.encodeFunctionData("setE3RefundManager", [c.e3RefundManager]),
    ),
    safeTx(
      c.loxley,
      i.loxley.encodeFunctionData("setSlashingManager", [c.slashingManager]),
    ),
  );

  if (BigInt(config.loxley.markFailedGracePeriod) > 0n) {
    txs.push(
      safeTx(
        c.loxley,
        i.loxley.encodeFunctionData("setMarkFailedGracePeriod", [
          BigInt(config.loxley.markFailedGracePeriod),
        ]),
      ),
    );
  }
  if (config.loxley.allowFeeToken) {
    txs.push(
      safeTx(
        c.loxley,
        i.loxley.encodeFunctionData("setFeeTokenAllowed", [
          config.feeToken,
          true,
        ]),
      ),
    );
  }
  appendCommitteeAndPricingTxs(txs, config, c, i);
}

function appendCommitteeAndPricingTxs(
  txs: SafeTransaction[],
  config: ProtocolConfigFile,
  c: ProtocolContracts,
  i: ProtocolInterfaces,
) {
  for (const threshold of config.loxley.committeeThresholds) {
    txs.push(
      safeTx(
        c.loxley,
        i.loxley.encodeFunctionData("setCommitteeThresholds", [
          BigInt(threshold.size),
          [BigInt(threshold.quorum), BigInt(threshold.total)],
        ]),
      ),
    );
  }
  if (config.loxley.registerActiveBfvParamSet) {
    const activeParams =
      ACTIVE_BFV_PARAM_SET === 0
        ? BFV_PARAMS.insecure512
        : BFV_PARAMS.secure8192;
    txs.push(
      safeTx(
        c.loxley,
        i.loxley.encodeFunctionData("setParamSet", [
          ACTIVE_BFV_PARAM_SET,
          encodeBfvParams(activeParams),
        ]),
      ),
    );
  }
  txs.push(
    safeTx(
      c.loxley,
      i.loxley.encodeFunctionData("setFeeAssetConfig", [
        {
          token: config.feeToken,
          expectedDecimals: config.feeTokenDecimals,
          pricing: pricingConfig(config.loxley.pricing),
        },
      ]),
    ),
  );
  appendVerifierTxs(txs, config, c, i);
}

function appendVerifierTxs(
  txs: SafeTransaction[],
  config: ProtocolConfigFile,
  c: ProtocolContracts,
  i: ProtocolInterfaces,
) {
  const decryption =
    c.decryptionVerifier ??
    optionalAddress(config.verifiers?.decryptionVerifier, "decryptionVerifier");
  if (decryption) {
    txs.push(
      safeTx(
        c.loxley,
        i.loxley.encodeFunctionData("setDecryptionVerifier", [
          ethersLib.id("fhe.rs:BFV"),
          decryption,
        ]),
      ),
    );
  }
  const pk =
    c.pkVerifier ?? optionalAddress(config.verifiers?.pkVerifier, "pkVerifier");
  if (pk) {
    txs.push(
      safeTx(
        c.loxley,
        i.loxley.encodeFunctionData("setPkVerifier", [
          ethersLib.id("fhe.rs:BFV"),
          pk,
        ]),
      ),
    );
  }
  // The compute-receipt verifier. Each E3 snapshots this at request time, so a later change never
  // affects an E3 in flight; leaving it unset means no protocol-level ciphertext verification.
  //
  // Three sources, in precedence order. A verifier deployed by this run wins, because it is the one
  // the rest of the deployment just wired up. Otherwise the config decides, and it is read from both
  // shapes `ProtocolConfig` declares: `verifiers.ciphertextVerifier` groups it with the other
  // verifier addresses, and the top-level field predates that grouping. Preferring one config shape
  // and ignoring the other would silently resolve to `undefined` for any config written against the
  // other, and an unset verifier is indistinguishable from one deliberately omitted — it just means
  // no ciphertext verification, with nothing to say it was a mistake.
  const ciphertext =
    c.ciphertextVerifier ??
    optionalAddress(
      config.verifiers?.ciphertextVerifier ?? config.ciphertextVerifier,
      "ciphertextVerifier",
    );
  if (ciphertext) {
    txs.push(
      safeTx(
        c.loxley,
        i.loxley.encodeFunctionData("setCiphertextVerifier", [
          ethersLib.id("fhe.rs:BFV"),
          ciphertext,
        ]),
      ),
    );
  }
  if (config.bindInitialE3Program) {
    const program = new ethersLib.Interface([
      "function bindLoxley(address loxley)",
    ]);
    txs.push(
      safeTx(
        config.e3Programs[0],
        program.encodeFunctionData("bindLoxley", [c.loxley]),
      ),
    );
  }
}
