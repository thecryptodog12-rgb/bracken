# brackenup

A standalone installer for the Bracken CLI tool.

## Installation

### Quick Install

Use the provided install script to download and install `brackenup`:

```bash
curl -fsSL https://raw.githubusercontent.com/thecryptodog12-rgb/bracken/main/install | bash
```

Or with wget:

```bash
wget -qO- https://raw.githubusercontent.com/thecryptodog12-rgb/bracken/main/install | bash
```

### Manual Installation

1. Download the appropriate binary for your platform from the
   [releases page](https://github.com/thecryptodog12-rgb/bracken/releases)
2. Extract the binary and place it in your PATH (e.g., `~/.local/bin` or `/usr/local/bin`)
3. Make sure the binary is executable: `chmod +x brackenup`

## Usage

### Install the Bracken CLI

```bash
# Install to ~/.local/bin (default)
brackenup install

# Install to /usr/local/bin (requires sudo)
brackenup install --system
```

### Update the Bracken CLI

```bash
# Update from ~/.local/bin
brackenup update

# Update from /usr/local/bin
brackenup update --system
```

### Uninstall the Bracken CLI

```bash
# Remove from ~/.local/bin
brackenup uninstall

# Remove from /usr/local/bin
brackenup uninstall --system
```

### Get Help

```bash
brackenup --help
brackenup install --help
```

## Building from Source

To build `brackenup` from source:

```bash
cd brackenup
cargo build --locked --release
```

The binary will be available at `target/release/brackenup`.

## Platform Support

| Platform | Architecture             | Status             |
| -------- | ------------------------ | ------------------ |
| Linux    | x86_64                   | ✅ Native binary   |
| macOS    | Apple Silicon (M1/M2/M3) | ✅ Native binary   |
| macOS    | Intel                    | ✅ Via Rosetta 2\* |

\* Intel Macs automatically run Apple Silicon binaries through Rosetta 2 translation

## Binary Naming Convention

The installer expects GitHub releases to contain assets with this naming pattern:

**For Bracken CLI:**

- `bracken-linux-x86_64.tar.gz`
- `bracken-macos-aarch64.tar.gz`

**For brackenup itself:**

- `brackenup-linux-x86_64.tar.gz`
- `brackenup-macos-aarch64.tar.gz`

Each tarball contains the binary at the root level.

## Dependencies

- `curl` or `wget` (for the install script)
- `tar` (for extracting archives)
- Internet connection (for downloading releases)
