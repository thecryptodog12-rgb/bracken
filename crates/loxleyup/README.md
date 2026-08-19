# loxleyup

A standalone installer for the Loxley CLI tool.

## Installation

### Quick Install

Use the provided install script to download and install `loxleyup`:

```bash
curl -fsSL https://raw.githubusercontent.com/gnosisguild/loxley/main/install | bash
```

Or with wget:

```bash
wget -qO- https://raw.githubusercontent.com/gnosisguild/loxley/main/install | bash
```

### Manual Installation

1. Download the appropriate binary for your platform from the
   [releases page](https://github.com/gnosisguild/loxley/releases)
2. Extract the binary and place it in your PATH (e.g., `~/.local/bin` or `/usr/local/bin`)
3. Make sure the binary is executable: `chmod +x loxleyup`

## Usage

### Install the Loxley CLI

```bash
# Install to ~/.local/bin (default)
loxleyup install

# Install to /usr/local/bin (requires sudo)
loxleyup install --system
```

### Update the Loxley CLI

```bash
# Update from ~/.local/bin
loxleyup update

# Update from /usr/local/bin
loxleyup update --system
```

### Uninstall the Loxley CLI

```bash
# Remove from ~/.local/bin
loxleyup uninstall

# Remove from /usr/local/bin
loxleyup uninstall --system
```

### Get Help

```bash
loxleyup --help
loxleyup install --help
```

## Building from Source

To build `loxleyup` from source:

```bash
cd loxleyup
cargo build --locked --release
```

The binary will be available at `target/release/loxleyup`.

## Platform Support

| Platform | Architecture             | Status             |
| -------- | ------------------------ | ------------------ |
| Linux    | x86_64                   | ✅ Native binary   |
| macOS    | Apple Silicon (M1/M2/M3) | ✅ Native binary   |
| macOS    | Intel                    | ✅ Via Rosetta 2\* |

\* Intel Macs automatically run Apple Silicon binaries through Rosetta 2 translation

## Binary Naming Convention

The installer expects GitHub releases to contain assets with this naming pattern:

**For Loxley CLI:**

- `loxley-linux-x86_64.tar.gz`
- `loxley-macos-aarch64.tar.gz`

**For loxleyup itself:**

- `loxleyup-linux-x86_64.tar.gz`
- `loxleyup-macos-aarch64.tar.gz`

Each tarball contains the binary at the root level.

## Dependencies

- `curl` or `wget` (for the install script)
- `tar` (for extracting archives)
- Internet connection (for downloading releases)
