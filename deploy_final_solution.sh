#!/bin/bash
set -e

echo "🎯 Monero->Solana Bridge - Final Solution (Direct Build)"
echo "=========================================================="
echo ""
echo "This bypasses cargo-build-sbf and builds directly with system Rust"
echo ""

VK_FILE="$1"
if [ -z "$VK_FILE" ]; then
    echo "Usage: $0 <path/to/file.vk>"
    exit 1
fi

VK_PATH=$(realpath "$VK_FILE")
VK_DIR=$(dirname "$VK_PATH")
VK_BASE=$(basename "$VK_FILE" .vk)

echo "📄 VK File: $VK_PATH"
echo "📁 Output Directory: $VK_DIR"
echo ""

# Step 1: Build with system cargo using Solana's Rust toolchain
echo "Step 1: Building with Solana Rust 1.89 toolchain..."
cd ~/sunspot/gnark-solana/crates/verifier-bin

# Use Solana's Rust toolchain directly
export RUSTC=~/.cache/solana/v1.52/rust/bin/rustc
export CARGO=~/.cache/solana/v1.52/rust/bin/cargo
export PATH="~/.cache/solana/v1.52/rust/bin:$PATH"

# Set VK path
export VK_PATH="$VK_PATH"

# Build for SBF target
echo "   Compiling for sbf-solana-solana target..."
$CARGO build \
  --target sbf-solana-solana \
  --release \
  -Zbuild-std=std,panic_abort

BUILD_STATUS=$?

if [ $BUILD_STATUS -ne 0 ]; then
    echo ""
    echo "❌ Build failed with exit code $BUILD_STATUS"
    exit 1
fi

# Find the built .so file (in workspace target directory)
SO_FILE=$(find ~/sunspot/gnark-solana/target/sbf-solana-solana/release -name "verifier_bin.so" -type f | head -1)

if [ -z "$SO_FILE" ]; then
    echo "❌ Error: No .so file found in build output"
    exit 1
fi

echo ""
echo "Step 2: Copying outputs..."
cp "$SO_FILE" "$VK_DIR/${VK_BASE}.so"

# Generate keypair
solana-keygen new --outfile "$VK_DIR/${VK_BASE}-keypair.json" --no-bip39-passphrase -s

echo ""
echo "✅ ✅ ✅ BUILD COMPLETED SUCCESSFULLY! ✅ ✅ ✅"
echo ""
echo "📦 Program: $VK_DIR/${VK_BASE}.so"
echo "🔑 Keypair: $VK_DIR/${VK_BASE}-keypair.json"
echo ""

# Get program ID
PROGRAM_ID=$(solana address -k "$VK_DIR/${VK_BASE}-keypair.json")
echo "🆔 Program ID: $PROGRAM_ID"
echo ""

echo "Next steps to deploy on devnet:"
echo "================================"
echo ""
echo "1. Deploy the program:"
echo "   solana program deploy $VK_DIR/${VK_BASE}.so \\"
echo "     --keypair keypair/deployer.json \\"
echo "     --program-id $VK_DIR/${VK_BASE}-keypair.json \\"
echo "     --url devnet"
echo ""
echo "2. Test verification:"
echo "   cd client && VERIFIER_PROGRAM_ID=$PROGRAM_ID npm run verify"
echo ""
