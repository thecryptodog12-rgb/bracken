// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
pragma solidity 0.8.28;

import { IBracken } from "../interfaces/IBracken.sol";
import { IE3RefundManager } from "../interfaces/IE3RefundManager.sol";

/// @notice Defines which party pays for each E3 failure reason.
library FailurePayerLib {
    function getFailurePayer(
        IBracken.FailureReason reason
    ) internal pure returns (IE3RefundManager.FailurePayer payer) {
        if (
            reason == IBracken.FailureReason.NoInputsReceived ||
            reason == IBracken.FailureReason.ComputeTimeout ||
            reason == IBracken.FailureReason.ComputeProviderExpired ||
            reason == IBracken.FailureReason.ComputeProviderFailed ||
            reason == IBracken.FailureReason.RequesterCancelled
        ) {
            return IE3RefundManager.FailurePayer.Requester;
        }

        if (
            reason == IBracken.FailureReason.CommitteeFormationTimeout ||
            reason == IBracken.FailureReason.InsufficientCommitteeMembers ||
            reason == IBracken.FailureReason.DKGTimeout ||
            reason == IBracken.FailureReason.DKGInvalidShares ||
            reason == IBracken.FailureReason.DecryptionTimeout ||
            reason == IBracken.FailureReason.DecryptionInvalidShares ||
            reason == IBracken.FailureReason.VerificationFailed
        ) {
            return IE3RefundManager.FailurePayer.Ciphernodes;
        }

        revert IE3RefundManager.InvalidFailureReason(reason);
    }
}
