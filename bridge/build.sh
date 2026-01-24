#!/bin/bash
set -e

echo "🔨 Building Monero→Solana Bridge Program..."

cd "$(dirname "$0")"

# Remove old Cargo.lock
rm -f Cargo.lock programs/bridge/Cargo.lock

# Use anchor build which handles everything
anchor build

echo "✅ Build complete!"
echo "📦 Program: target/deploy/bridge.so"
