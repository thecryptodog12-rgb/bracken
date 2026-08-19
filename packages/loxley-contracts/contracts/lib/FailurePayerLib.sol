// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
pragma solidity 0.8.28;

import { ILoxley } from "../interfaces/ILoxley.sol";
import { IE3RefundManager } from "../interfaces/IE3RefundManager.sol";

/// @notice Defines which party pays for each E3 failure reason.
library FailurePayerLib {
    function getFailurePayer(
        ILoxley.FailureReason reason
    ) internal pure returns (IE3RefundManager.FailurePayer payer) {
        if (
            reason == ILoxley.FailureReason.NoInputsReceived ||
            reason == ILoxley.FailureReason.ComputeTimeout ||
            reason == ILoxley.FailureReason.ComputeProviderExpired ||
            reason == ILoxley.FailureReason.ComputeProviderFailed ||
            reason == ILoxley.FailureReason.RequesterCancelled
        ) {
            return IE3RefundManager.FailurePayer.Requester;
        }

        if (
            reason == ILoxley.FailureReason.CommitteeFormationTimeout ||
            reason == ILoxley.FailureReason.InsufficientCommitteeMembers ||
            reason == ILoxley.FailureReason.DKGTimeout ||
            reason == ILoxley.FailureReason.DKGInvalidShares ||
            reason == ILoxley.FailureReason.DecryptionTimeout ||
            reason == ILoxley.FailureReason.DecryptionInvalidShares ||
            reason == ILoxley.FailureReason.VerificationFailed
        ) {
            return IE3RefundManager.FailurePayer.Ciphernodes;
        }

        revert IE3RefundManager.InvalidFailureReason(reason);
    }
}
