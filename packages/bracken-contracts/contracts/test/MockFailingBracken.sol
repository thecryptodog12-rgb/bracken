// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
pragma solidity 0.8.28;

import { IBracken } from "../interfaces/IBracken.sol";

contract MockFailingBracken {
    error FailureCallbackRejected();

    function getE3Stage(uint256) external pure returns (IBracken.E3Stage) {
        return IBracken.E3Stage.KeyPublished;
    }

    function onE3Failed(uint256, uint8) external pure {
        revert FailureCallbackRejected();
    }
}
