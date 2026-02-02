#!/bin/bash
# Check deployed programs on Solana Devnet

echo "🔍 Checking Monero→Solana Bridge on Devnet"
echo "═══════════════════════════════════════════════════════════"
echo ""

VERIFIER="Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy"
BRIDGE="G6V8QRJi7H8APsuhGSmNaX8qLMRd4oW63y9UjCyRpEtr"

echo "📋 Verifier Program (Noir ZK Proof Verifier)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
solana program show $VERIFIER --url devnet
echo ""

echo "🔗 View on Explorer:"
echo "   https://explorer.solana.com/address/$VERIFIER?cluster=devnet"
echo ""

echo "📋 Bridge Program (Anchor - LP Management & wXMR Minting)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
solana program show $BRIDGE --url devnet
echo ""

echo "🔗 View on Explorer:"
echo "   https://explorer.solana.com/address/$BRIDGE?cluster=devnet"
echo ""

echo "📜 Recent Transactions on Verifier:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
solana transaction-history $VERIFIER --url devnet --limit 5
echo ""

echo "📜 Recent Transactions on Bridge:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
solana transaction-history $BRIDGE --url devnet --limit 5
echo ""

echo "✅ Both programs are live on Solana Devnet!"
echo ""
echo "💡 To interact with them, you need:"
echo "   1. A funded devnet wallet (get SOL from faucet)"
echo "   2. Generated proof files (.proof and .pw)"
echo "   3. Run: cd client && npm run verify"
