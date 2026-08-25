#!/usr/bin/env bash

set -euo pipefail

concurrently -kr \
  "./scripts/dev_cipher.sh ./.bracken/ready" \
  "./scripts/dev_program.sh" \
  "wait-on tcp:13151 && ./scripts/dev_server.sh" \
  "wait-on tcp:4000 && wait-on file:./.bracken/ready && ./scripts/dev_client.sh"
