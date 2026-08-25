#!/usr/bin/env bash

RUSTFLAGS="-A warnings" cargo run --quiet --bin bracken -- -v "$@"
