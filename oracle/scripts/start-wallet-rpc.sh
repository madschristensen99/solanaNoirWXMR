#!/bin/bash

# Start monero-wallet-rpc for stagenet
# This allows us to interact with a Monero wallet via JSON-RPC

STAGENET_DAEMON="https://stagenet.xmr.ditatompel.com"
RPC_PORT="38083"
WALLET_DIR="./wallets"

mkdir -p "$WALLET_DIR"

echo "🚀 Starting monero-wallet-rpc for stagenet..."
echo "   Daemon: $STAGENET_DAEMON"
echo "   RPC Port: $RPC_PORT"
echo "   Wallet Dir: $WALLET_DIR"
echo ""

# Check if monero-wallet-rpc is installed
if ! command -v monero-wallet-rpc &> /dev/null; then
    echo "❌ monero-wallet-rpc not found!"
    echo ""
    echo "Please install Monero CLI tools:"
    echo "   Ubuntu/Debian: sudo apt install monero"
    echo "   Or download from: https://www.getmonero.org/downloads/"
    exit 1
fi

# Start wallet RPC
monero-wallet-rpc \
  --stagenet \
  --daemon-address "$STAGENET_DAEMON" \
  --trusted-daemon \
  --allow-mismatched-daemon-version \
  --daemon-ssl-allow-any-cert \
  --rpc-bind-port "$RPC_PORT" \
  --wallet-dir "$WALLET_DIR" \
  --disable-rpc-login \
  --log-level 1

# Note: Use Ctrl+C to stop
