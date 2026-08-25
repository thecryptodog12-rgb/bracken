#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/dev_config.sh"

load_template_dev_config
cd "${TEMPLATE_ROOT}"

echo "bracken rev = $(bracken rev)"
echo "Waiting on ciphernodes to be ready..."
pnpm wait-on file:/tmp/bracken_ciphernodes_ready && bracken program start
