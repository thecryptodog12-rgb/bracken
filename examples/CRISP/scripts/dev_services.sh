#!/usr/bin/env bash

set -euo pipefail

concurrently -kr \
  "./scripts/dev_cipher.sh ./.loxley/ready" \
  "./scripts/dev_program.sh" \
  "wait-on tcp:13151 && ./scripts/dev_server.sh" \
  "wait-on tcp:4000 && wait-on file:./.loxley/ready && ./scripts/dev_client.sh"
