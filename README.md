<div align="center">
  <picture>
    <img src="./docs/public/bracken-meta.jpg" alt="Bracken" width="100%">
  </picture>

[![Docs][docs-badge]][docs] [![Github Actions][gha-badge]][gha] [![Hardhat][hardhat-badge]][hardhat]
[![License: LGPL v3][license-badge]][license]

</div>

# Bracken

> **Note:** Bracken is a fork of [theinterfold/interfold](https://github.com/theinterfold/interfold)
> (LGPL-3.0), retargeted at Robinhood Chain (chain id `4663`). Upstream was itself previously known
> as **Enclave**.
>
> **Nothing is deployed yet.** Contract addresses throughout this repo and the docs are placeholders;
> the upstream Ethereum deployment is archived in
> `packages/bracken-contracts/upstream-interfold-deployments.reference.json`. No BRACKEN token exists —
> the tokenomics pages describe upstream's FOLD and are flagged as such.
>
> Links to `theinterfold.com` are deliberate: that content lives upstream and renaming the URLs would
> only break them.

This is the monorepo for **Bracken**, an open-source protocol for confidential coordination.

Bracken leverages a combination of Fully Homomorphic Encryption (FHE), Zero-Knowledge Proofs
(ZKPs), and Multi-Party Computation (MPC) to enable Encrypted Execution Environments (E3), with
integrity and privacy guarantees rooted in cryptography and economics, rather than hardware and
attestations.

## Documentation

Full documentation is available at: https://docs.theinterfold.com

## Quick Start

Follow instructions in the [quick start][quick-start] section of the documentation.

See the [CRISP example][crisp] for a fully functioning example application.

## Getting Help

Join the community [Telegram group][telegram].

## Contributing

See [CONTRIBUTING.md][contributing].

## Development

This section covers the essential commands for setting up and working with the Bracken codebase
locally.

```bash
# Install dependencies
pnpm i

# Build the project
pnpm build

# Clean build artifacts
pnpm clean
```

### Testing

**⚠️ Important:** Always run tests through pnpm scripts, not directly via `cargo test` or other
build tools. The pnpm scripts ensure necessary setup steps are executed (e.g., building required
binaries, setting up test environments) that may be skipped when running tests directly.

#### Test Scripts

The monorepo provides several test scripts for different components:

- **`pnpm test`** - Runs all tests across the entire monorepo:
  - EVM/Smart contract tests (`evm:test`)
  - Rust crate tests (`rust:test`)
  - SDK tests (`sdk:test`)
  - Noir circuit tests (`noir:test`)

- **`pnpm rust:test`** - Runs all Rust crate tests in the `crates/` directory. This script runs
  tests for all crates in the workspace, not just ciphernode-related crates.

- **`pnpm evm:test`** - Runs tests for the EVM smart contracts in `packages/bracken-contracts`.

- **`pnpm sdk:test`** - Runs tests for the TypeScript SDK in `packages/bracken-sdk`.

- **`pnpm noir:test`** - Runs tests for Noir circuits in the `circuits/` directory using
  `nargo test`. Requires the [Noir toolchain](https://noir-lang.org/docs/installation) (`nargo`) and
  [Barretenberg](https://github.com/AztecProtocol/aztec-packages/tree/master/barretenberg) (`bb`) to
  be installed and on your `PATH`.

- **`pnpm test:integration`** - Runs integration tests from `tests/integration/`. These tests may
  require prebuilt binaries and can be run with `--no-prebuild` if binaries are already available.
  Pre-built circuit artifacts for the configured BFV preset must be present in the `circuits/`
  artifacts directory.

#### Running Individual Test Suites

```bash
# Run only Rust crate tests
pnpm rust:test

# Run only EVM/smart contract tests
pnpm evm:test

# Run only SDK tests
pnpm sdk:test

# Run only Noir circuit tests
pnpm noir:test

# Run only integration tests
pnpm test:integration

# Run integration tests without prebuild step (if binaries already exist)
pnpm test:integration --no-prebuild
```

### Contributors

<!-- readme: contributors -start -->
<table>
	<tbody>
		<tr>
            <td align="center">
                <a href="https://github.com/ryardley">
                    <img src="https://avatars.githubusercontent.com/u/1256409?v=4" width="100;" alt="ryardley"/>
                    <br />
                    <sub><b>гλ</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/auryn-macmillan">
                    <img src="https://avatars.githubusercontent.com/u/8453294?v=4" width="100;" alt="auryn-macmillan"/>
                    <br />
                    <sub><b>Auryn Macmillan</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/hmzakhalid">
                    <img src="https://avatars.githubusercontent.com/u/36852564?v=4" width="100;" alt="hmzakhalid"/>
                    <br />
                    <sub><b>Hamza Khalid</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/samepant">
                    <img src="https://avatars.githubusercontent.com/u/6718506?v=4" width="100;" alt="samepant"/>
                    <br />
                    <sub><b>samepant</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/ctrlc03">
                    <img src="https://avatars.githubusercontent.com/u/93448202?v=4" width="100;" alt="ctrlc03"/>
                    <br />
                    <sub><b>ctrlc03</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/cristovaoth">
                    <img src="https://avatars.githubusercontent.com/u/12870300?v=4" width="100;" alt="cristovaoth"/>
                    <br />
                    <sub><b>Cristóvão</b></sub>
                </a>
            </td>
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/nginnever">
                    <img src="https://avatars.githubusercontent.com/u/7103153?v=4" width="100;" alt="nginnever"/>
                    <br />
                    <sub><b>Nathan Ginnever</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/0xjei">
                    <img src="https://avatars.githubusercontent.com/u/20580910?v=4" width="100;" alt="0xjei"/>
                    <br />
                    <sub><b>Giacomo</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/cedoor">
                    <img src="https://avatars.githubusercontent.com/u/11427903?v=4" width="100;" alt="cedoor"/>
                    <br />
                    <sub><b>Cedoor</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/ozgurarmanc">
                    <img src="https://avatars.githubusercontent.com/u/94117770?v=4" width="100;" alt="ozgurarmanc"/>
                    <br />
                    <sub><b>Armanc</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/Subhasish-Behera">
                    <img src="https://avatars.githubusercontent.com/u/92573882?v=4" width="100;" alt="Subhasish-Behera"/>
                    <br />
                    <sub><b>SUBHASISH BEHERA</b></sub>
                </a>
            </td>
		</tr>
	<tbody>
</table>
<!-- readme: contributors-end -->

## Minimum Rust version

This workspace's minimum supported rustc version is 1.91.1.

## Architecture

Bracken employs a modular architecture involving numerous actors and participants. The sequence
diagram below offers a high-level overview of the protocol, but necessarily omits most detail.

```mermaid
sequenceDiagram
    participant Users
    participant Bracken
    participant CiphernodeRegistry
    participant E3Program
    participant ComputeProvider
    participant DecryptionVerifier

    Users->>Bracken: request(parameters)
    Bracken->>E3Program: validate(e3ProgramParams)
    Bracken->>ComputeProvider: validate(computeProviderParams)
    ComputeProvider-->>Bracken: decryptionVerifier
    Bracken->>CiphernodeRegistry: requestCommittee(e3Id, legacySeed, threshold)
    CiphernodeRegistry->>CiphernodeRegistry: commit future entropy block
    CiphernodeRegistry-->>Bracken: success
    Bracken-->>Users: e3Id, E3 struct

    Users->>Bracken: activate(e3Id)
    Bracken->>CiphernodeRegistry: committeePublicKey(e3Id)
    CiphernodeRegistry-->>Bracken: publicKey
    Bracken->>Bracken: Set expiration and committeePublicKey
    Bracken-->>Users: success

    Users->>Bracken: publishInput(e3Id, data)
    Bracken->>E3Program: validateInput(msg.sender, data)
    E3Program-->>Bracken: input, success
    Bracken->>Bracken: Store input
    Bracken-->>Users: success

    Users->>Bracken: publishCiphertextOutput(e3Id, data)
    Bracken->>DecryptionVerifier: verify(e3Id, data)
    DecryptionVerifier-->>Bracken: output, success
    Bracken->>Bracken: Store ciphertextOutput
    Bracken-->>Users: success

    Users->>Bracken: publishPlaintextOutput(e3Id, data)
    Bracken->>E3Program: verify(e3Id, data)
    E3Program-->>Bracken: output, success
    Bracken->>Bracken: Store plaintextOutput
    Bracken-->>Users: success
```

## 🚀 Release Process

### Overview

Bracken uses a unified versioning strategy where all packages (Rust crates and npm packages)
share the same version number. Releases are triggered by git tags and follow semantic versioning.

### Quick Release

```bash
# One command to release! 🎉
pnpm bump:versions 1.0.0

# This automatically:
# - Bumps all versions
# - Generates changelog
# - Commits changes
# - Creates tag
# - Pushes to GitHub
# - Triggers release workflow
```

### Detailed Release Workflow

#### 1. Development Phase

Developers work on features and fixes, committing with
[conventional commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add new encryption module"
git commit -m "fix: resolve memory leak in SDK"
git commit -m "docs: update API documentation"
git commit -m "BREAKING CHANGE: redesign configuration API"
```

#### 2. Release Execution

When ready to release, maintainers run a single command:

```bash
# For stable release
pnpm bump:versions 1.0.0

# For pre-release
pnpm bump:versions 1.0.0-beta.1
```

This command automatically:

- ✅ Validates working directory is clean
- ✅ Updates version in `Cargo.toml` (workspace version)
- ✅ Updates version in all npm `package.json` files
- ✅ Updates lock files (`Cargo.lock`, `pnpm-lock.yaml`)
- ✅ Generates/updates `CHANGELOG.md` from commit history
- ✅ Commits changes: `chore(release): bump version to X.Y.Z`
- ✅ Creates annotated tag: `vX.Y.Z`
- ✅ Pushes commits and tag to GitHub
- ✅ **Triggers automated release workflow**

Please ensure you are in release branch before running the command. For example,
`git checkout -b chore/release-v1.0.0-beta.1`.

#### 3. Alternative: Manual Review Before Push

If you prefer to review changes before pushing:

```bash
# Prepare release locally (no push)
pnpm bump:versions --no-push 1.0.0

# Review the changes
git diff HEAD~1
cat CHANGELOG.md

# If everything looks good, push
git push && git push --tags
```

#### 4. Automated Release Pipeline

Once the tag is pushed, GitHub Actions automatically:

1. **Validates** version consistency across all packages
2. **Builds** binaries for all platforms:
   - Linux (x86_64)
   - macOS (x86_64, aarch64)
3. **Runs** all tests
4. **Publishes** packages:
   - All versions (stable and pre-release):
     - ✅ Publishes to crates.io
     - ✅ Publishes to npm
   - Tag differences:
     - Stable (`v1.0.0`): npm `latest` tag, updates `stable` git tag
     - Pre-release (`v1.0.0-beta.1`): npm `next` tag, no `stable` tag update
5. **Creates** GitHub Release with:
   - Binary downloads for all platforms
   - Release notes from CHANGELOG.md
   - SHA256 checksums
   - Installation instructions

## 🏷️ Version Strategy

### Version Format

Bracken follows [Semantic Versioning](https://semver.org/):

- **Stable**: `v1.0.0` - Production ready
- **Pre-release**: `v1.0.0-beta.1` - Testing/preview versions
  - `-alpha.X` - Early development, may have breaking changes
  - `-beta.X` - Feature complete, testing for bugs
  - `-rc.X` - Release candidate, final testing

### Which Version Should I Use?

#### For Production (Mainnet)

Use stable versions only:

```bash
brackenup install              # Latest stable
brackenup install v1.0.0       # Specific stable version
```

#### For Testing (Testnet)

You can use pre-release versions:

```bash
brackenup install --pre-release # Latest pre-release
brackenup install v1.0.0-beta.1 # Specific pre-release
```

#### For Development

Build from source:

```bash
git clone https://github.com/thecryptodog12-rgb/bracken.git
cd bracken
cargo build --release
```

## 🌿 Branch and Tag Strategy

### Current Setup

- **`main`** - Latest code. All releases are tagged from here. Using feature flags for experimental
  features, we ensure that code is always stable.
- **`v*.*.*`** - Version tags for releases
- **`stable`** - Always points to the latest stable release

### Installation Sources

```bash
# Latest stable release (recommended for production)
curl -fsSL https://raw.githubusercontent.com/thecryptodog12-rgb/bracken/stable/install | bash

# Latest development version (may be unstable)
curl -fsSL https://raw.githubusercontent.com/thecryptodog12-rgb/bracken/main/install | bash
```

## 📋 Release Checklist

For maintainers doing a release:

- [ ] Ensure all tests pass on `main`
- [ ] Review commits since last release for proper conventional format
- [ ] Decide version number (major/minor/patch)
- [ ] Run: `pnpm bump:versions X.Y.Z`
- [ ] Monitor GitHub Actions for successful deployment
- [ ] Verify packages on [npm](https://www.npmjs.com/org/bracken) and
      [crates.io](https://crates.io/search?q=bracken)
- [ ] Check GitHub release page for binaries and changelog
- [ ] Announce release (Discord/Twitter/etc)

## 🔧 Script Options

The `bump:versions` script supports several options:

```bash
# Full automatic release (default)
pnpm bump:versions 1.0.0

# Local only - don't push
pnpm bump:versions --no-push 1.0.0

# Skip git operations entirely
pnpm bump:versions --skip-git 1.0.0

# Dry run - see what would happen
pnpm bump:versions --dry-run 1.0.0

# Show help
pnpm bump:versions --help
```

## 🔄 Rollback Procedure

If a release has issues:

1. **Mark as deprecated on npm**:

   ```bash
   npm deprecate @bracken/sdk@1.0.0 "Critical bug, use 1.0.1"
   ```

2. **Yank from crates.io** (if critical):

   ```bash
   cargo yank --version 1.0.0 bracken
   ```

3. **Fix and release patch**:
   ```bash
   pnpm bump:versions 1.0.1
   ```

## 📊 Version History

Check our [Releases page](https://github.com/thecryptodog12-rgb/bracken/releases) for full version history
and changelogs.

## Security and Liability

This repo is provided WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
FITNESS FOR A PARTICULAR PURPOSE.

## License

This repo created under the [LGPL-3.0+ license](LICENSE.md).

[gha]: https://github.com/thecryptodog12-rgb/bracken/actions
[gha-badge]: https://github.com/thecryptodog12-rgb/bracken/actions/workflows/ci.yml/badge.svg
[hardhat]: https://hardhat.org/
[hardhat-badge]: https://img.shields.io/badge/Built%20with-Hardhat-FFDB1C.svg
[license]: https://opensource.org/license/lgpl-3-0
[license-badge]: https://img.shields.io/badge/License-LGPLv3.0-blue.svg
[docs]: https://docs.theinterfold.com
[docs-badge]: https://img.shields.io/badge/Documentation-blue.svg
[quick-start]: https://docs.theinterfold.com/quick-start
[crisp]: https://docs.theinterfold.com/CRISP/introduction
[telegram]: https://t.me/+raYAZgrwgOw2ODJh
[contributing]: CONTRIBUTING.md
