#!/bin/bash
set -e

echo "🔨 Building Bridge Program with Solana Rust 1.89"
echo "================================================"

cd "$(dirname "$0")"

# Use Solana's Rust 1.89 toolchain
SOLANA_RUST="$HOME/.cache/solana/v1.52/rust"
SOLANA_CARGO="$SOLANA_RUST/bin/cargo"

# Clean
rm -f Cargo.lock
rm -rf target/deploy
mkdir -p target/deploy

# Generate lockfile with Rust 1.89
echo "📝 Generating Cargo.lock..."
cargo +1.89 generate-lockfile

# Build with Solana toolchain
echo "🔧 Building..."
export RUSTUP_TOOLCHAIN="$SOLANA_RUST"
"$SOLANA_CARGO" build \
    --manifest-path programs/bridge/Cargo.toml \
    --target sbf-solana-solana \
    --release \
    --locked

# Copy binary
echo "📦 Copying binary..."
cp target/sbf-solana-solana/release/bridge.so target/deploy/

# Generate keypair if needed
if [ ! -f "target/deploy/bridge-keypair.json" ]; then
    solana-keygen new --no-bip39-passphrase --outfile target/deploy/bridge-keypair.json
fi

PROGRAM_ID=$(solana-keygen pubkey target/deploy/bridge-keypair.json)
echo ""
echo "✅ Build complete!"
echo "📦 Binary: target/deploy/bridge.so"
echo "🔑 Program ID: $PROGRAM_ID"
echo ""
echo "To deploy:"
echo "  solana program deploy target/deploy/bridge.so --program-id target/deploy/bridge-keypair.json"
