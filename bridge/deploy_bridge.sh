#!/bin/bash
set -e

echo "🚀 Monero->Solana Bridge - Engineered Deployment Solution"
echo "=========================================================="
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

# Step 1: Generate initial Cargo.lock with Solana toolchain
echo "Step 1: Generating Cargo.lock with Solana v1.52 toolchain (Rust 1.89)..."
cd ~/sunspot/gnark-solana
rm -f Cargo.lock
~/.cache/solana/v1.52/rust/bin/cargo generate-lockfile

# Step 2: Verify Cargo.lock was generated
echo "Step 2: Verifying Cargo.lock..."
if [ ! -f "Cargo.lock" ]; then
    echo "❌ Error: Cargo.lock was not generated!"
    exit 1
fi
echo "   ✓ Cargo.lock generated successfully"

# Step 3: Build
echo ""
echo "Step 3: Building Solana program (this may take a few minutes)..."
echo ""
cd ~/sunspot/gnark-solana/crates/verifier-bin
VK_PATH="$VK_PATH" cargo build-sbf --sbf-out-dir "$VK_DIR"

BUILD_STATUS=$?

if [ $BUILD_STATUS -ne 0 ]; then
    echo ""
    echo "❌ Build failed with exit code $BUILD_STATUS"
    exit 1
fi

# Step 5: Rename outputs
echo ""
echo "Step 5: Renaming outputs..."
if [ -f "$VK_DIR/verifier_bin.so" ]; then
    mv "$VK_DIR/verifier_bin.so" "$VK_DIR/${VK_BASE}.so"
    mv "$VK_DIR/verifier_bin-keypair.json" "$VK_DIR/${VK_BASE}-keypair.json"
    
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
    echo "     --keypair $VK_DIR/${VK_BASE}-keypair.json \\"
    echo "     --url devnet"
    echo ""
    echo "2. Fund the program account if needed:"
    echo "   solana airdrop 2 $PROGRAM_ID --url devnet"
    echo ""
    echo "3. Test verification (after deployment):"
    echo "   cd client && VERIFIER_PROGRAM_ID=$PROGRAM_ID npm run verify"
    echo ""
else
    echo "❌ Error: verifier_bin.so not found in $VK_DIR"
    ls -la "$VK_DIR"
    exit 1
fi
