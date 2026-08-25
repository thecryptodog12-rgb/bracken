// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.
pragma solidity 0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { Nonces } from "@openzeppelin/contracts/utils/Nonces.sol";
import { ILockAwareCiphernodeBondToken } from "../interfaces/ILockAwareCiphernodeBondToken.sol";

/// @title BrackenBondToken
/// @notice A plain, fixed-supply ERC-20 for ciphernode bonding.
///
/// @dev Why this exists instead of `BrackenToken`.
///
///      `BrackenToken` carries a launch mechanism: `CCA_START` and `CCA_END` are
///      immutable, `tge()` reverts until 40 days after `CCA_END`, and transfers
///      are blocked until it fires. That is the right shape for a protocol that
///      runs its own auction. It is the wrong shape for one launching on a DEX,
///      where the first thing you need is a token that can move.
///
///      `BondingRegistry` asks for nothing more than `IERC20` — it calls
///      `transferFrom` and `balanceOf` and nothing else. So bonding works with
///      an ordinary token, and everything the auction machinery adds is cost.
///
///      Deliberately minimal, because every extra power here is a promise
///      someone has to trust:
///
///        - Fixed supply, minted once in the constructor. There is no `mint`,
///          so supply cannot grow. No owner is stored, so there is nothing to
///          renounce and no key that could later dilute holders.
///        - No transfer hooks, no fees, no blocklist, no pause. A token used as
///          collateral must not be able to freeze the collateral.
///        - `ERC20Permit` is included because bonding needs an approval, and
///          gasless approval is a real convenience with no added authority.
///
///      18 decimals: the BondingRegistry's bond amounts assume it. The fee and
///      ticket collateral token is a separate contract and needs 6.
contract BrackenBondToken is ERC20, ERC20Permit, ERC20Votes, ILockAwareCiphernodeBondToken {
    /// @param name_ Token name, e.g. "Bracken".
    /// @param symbol_ Token symbol, e.g. "BRACKEN".
    /// @param initialSupply Whole tokens minted to `recipient` (scaled by 1e18).
    /// @param recipient Receives the entire supply. Use a multisig if one exists.
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply,
        address recipient
    ) ERC20(name_, symbol_) ERC20Permit(name_) {
        require(recipient != address(0), "recipient is zero");
        require(initialSupply > 0, "supply is zero");
        _mint(recipient, initialSupply * 10 ** decimals());
    }

    // ── Clock ───────────────────────────────────────────────────────────────
    // Timestamps, not block numbers.
    //
    // OpenZeppelin's ERC20Votes defaults to block numbers. BondedCheckpoints
    // uses block.timestamp, and BondedVotes refuses to bind two histories whose
    // clocks disagree -- summing a timestamp-keyed history with a block-numbered
    // one would produce a number for two unrelated points in time, and nothing
    // downstream could tell. It checks once at deployment and reverts with
    // ClockMismatch, which is exactly what a plain ERC20Votes token hits.

    /// @notice EIP-6372 clock: unix timestamp.
    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    /// @notice EIP-6372 clock mode.
    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    // ── Lock reporting ──────────────────────────────────────────────────────
    // This token has no vesting, no cliffs and no locks: every balance is fully
    // transferable the moment it exists. Zero is the honest answer, not a stub.

    /// @inheritdoc ILockAwareCiphernodeBondToken
    function lockedBalanceOf(address) external pure returns (uint256) {
        return 0;
    }

    /// @inheritdoc ILockAwareCiphernodeBondToken
    function lockedBalanceAt(address, uint64) external pure returns (uint256) {
        return 0;
    }

    // ── Diamond-resolution overrides ────────────────────────────────────────
    // ERC20Votes and ERC20Permit both extend ERC20/Nonces; Solidity needs the
    // linearisation spelled out.

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(
        address owner
    ) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
