#!/usr/bin/env bash
# Shared paths and optional monorepo circuit build helpers for the default template.

_template_dev_config_root() {
  (cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
}

load_template_dev_config() {
  TEMPLATE_ROOT="$(_template_dev_config_root)"
  BRACKEN_REPO_ROOT="$(cd "${TEMPLATE_ROOT}/../.." && pwd)"

  BFV_PRESET="${BFV_PRESET:-insecure-512}"
  COMMITTEE="${COMMITTEE:-minimum}"

  case "$BFV_PRESET" in
    insecure-512 | secure-8192) ;;
    *)
      echo "Invalid BFV_PRESET='${BFV_PRESET}' (use insecure-512 or secure-8192)" >&2
      exit 1
      ;;
  esac

  export TEMPLATE_ROOT BRACKEN_REPO_ROOT BFV_PRESET COMMITTEE
}

template_monorepo_build_available() {
  [[ -f "${BRACKEN_REPO_ROOT}/scripts/build-circuits.ts" ]]
}

# Whether the installed `bracken` carries an optional Cargo feature.
#
# Features are resolved when the binary is compiled, so the presence of a
# monorepo checkout proves nothing about the binary on PATH: a stale or
# release-profile install passes a checkout test and still rejects the feature at
# startup. Ask the binary instead. `rev --features` needs no config and prints
# nothing for a release build.
template_cli_has_feature() {
  local feature="$1"
  local compiled

  if ! command -v bracken >/dev/null 2>&1; then
    return 1
  fi

  # `|| true`: an older CLI without `--features` exits non-zero, which must read
  # as "feature absent" rather than abort a `set -e` caller.
  compiled="$(bracken rev --features 2>/dev/null || true)"
  printf '%s\n' "${compiled}" | grep -qxF "${feature}"
}

build_bracken_circuits_at_setup() {
  if ! template_monorepo_build_available; then
    echo "Skipping circuit build (standalone template; use bracken noir setup release artifacts)."
    return 0
  fi

  echo "Building bracken circuits (preset=${BFV_PRESET}, committee=${COMMITTEE})..."
  (
    cd "${BRACKEN_REPO_ROOT}" &&
      pnpm build:circuits \
        --preset "${BFV_PRESET}" \
        --committee "${COMMITTEE}" \
        --skip-if-built
  )
}

sync_bracken_circuit_artifacts() {
  if ! template_monorepo_build_available; then
    return 0
  fi

  local src="${BRACKEN_REPO_ROOT}/dist/circuits/${BFV_PRESET}/${COMMITTEE}"
  local dst="${TEMPLATE_ROOT}/.bracken/noir/circuits/${BFV_PRESET}/${COMMITTEE}"

  if [[ ! -f "${src}/recursive/dkg/pk/pk.json" ]]; then
    echo "No built circuits at ${src}; run pnpm dev:setup first. Using bracken noir setup release layout."
    return 0
  fi

  echo "Syncing circuits ${BFV_PRESET}/${COMMITTEE} → ${dst}"
  mkdir -p "$(dirname "${dst}")"
  rm -rf "${dst}"
  cp -R "${src}" "$(dirname "${dst}")/"
}
