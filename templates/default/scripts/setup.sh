#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/dev_config.sh"

load_template_dev_config
cd "${TEMPLATE_ROOT}"

echo "Installing dependencies..."
pnpm install --frozen-lockfile

echo "Installing Cargo dependencies..."
cargo build

echo "Compiling guest program..."
if [[ ! -f './.bracken/generated/contracts/ImageID.sol' ]]; then
  bracken program compile
fi

build_bracken_circuits_at_setup

echo "Compiling contracts..."
pnpm compile

# `test-only-skip-proof-aggregation` is compiled in unconditionally: it only lets the node honour
# the opt-in `skip_proof_aggregation` setting, and with that setting unset the binary behaves
# identically. `scripts/test_integration.sh` exports E3_NODES__CN*__SKIP_PROOF_AGGREGATION=true,
# and without the feature every ciphernode exits at startup (crates/entrypoint/src/start/start.rs).
# Proof aggregation stays enabled by default for template users - that is the runtime setting, not
# this build flag. Matches how CI builds the binary the template tests run against (ci.yml).
#
# Only the in-monorepo checkout can build it. A standalone template gets its binary from a release
# install, so there is nothing to build from here - the old `[[ ! -f ~/.cargo/bin/bracken ]]`
# guard was doing double duty for that case.
if template_monorepo_build_available; then
  echo "Building and installing bracken CLI..."
  # Always reinstall so a stale binary from an earlier checkout cannot silently survive.
  (cd "${BRACKEN_REPO_ROOT}" &&
    cargo install --locked --path crates/cli --bin bracken -f \
      --features test-only-skip-proof-aggregation)
elif [[ ! -f ~/.cargo/bin/bracken ]] && ! command -v bracken >/dev/null 2>&1; then
  echo "bracken CLI not found and this is a standalone template (no monorepo at" >&2
  echo "${BRACKEN_REPO_ROOT}). Install it first, then re-run setup." >&2
  exit 1
else
  echo "Standalone template: using the already-installed bracken CLI."
fi

echo "Running bracken noir setup..."
bracken noir setup

echo "Template setup complete."
