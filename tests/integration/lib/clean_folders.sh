#!/usr/bin/env bash
clean_folders() {
    local SCRIPT_DIR=$1

    # Delete output artifacts
    rm -rf "$SCRIPT_DIR/output/"*

    # Reset per-run node state without deleting the source-aligned Noir
    # artifacts staged by prebuild.sh. Removing the whole .loxley directory
    # makes `loxley noir setup` download the released circuit bundle, which
    # can have an older ABI than the Rust witness code under test.
    rm -rf \
        "$SCRIPT_DIR/.loxley/config" \
        "$SCRIPT_DIR/.loxley/data" \
        "$SCRIPT_DIR/.loxley/noir/work"
}

clean_folders $1
