#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Verifying Noir Proof on Solana Devnet                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

VERIFIER_PROGRAM="Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy"

# Check if witness exists
if [ ! -f "target/witness.gz" ]; then
    echo "❌ No witness found. Run 'nargo execute' first."
    exit 1
fi

echo "✅ Witness found: target/witness.gz"
echo "📊 Size: $(wc -c < target/witness.gz) bytes"
echo ""

# Check Solana connection
echo "🌐 Connecting to Solana devnet..."
solana config set --url https://api.devnet.solana.com > /dev/null 2>&1

BALANCE=$(solana balance 2>/dev/null | awk '{print $1}')
echo "💰 Wallet balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 0.1" | bc -l) )); then
    echo "⚠️  Low balance, requesting airdrop..."
    solana airdrop 1 2>&1 | grep -E "(Success|Error|signature)"
    sleep 2
fi

echo ""
echo "🔐 Verifier Program: $VERIFIER_PROGRAM"
echo ""

# Create a simple transaction to the verifier
# Note: The actual verification would require the full proof format
# For demo, we'll show the transaction structure

echo "📝 Creating verification transaction..."
echo ""
echo "Transaction would include:"
echo "  - Instruction: verify_proof"
echo "  - Data: witness.gz contents"
echo "  - Accounts: [wallet (signer)]"
echo ""

# Show what the actual call would look like
cat << 'TYPESCRIPT'
// Actual TypeScript verification code:
import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { readFileSync } from 'fs';

const connection = new Connection('https://api.devnet.solana.com');
const verifier = new PublicKey('Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy');
const witness = readFileSync('target/witness.gz');

const ix = new TransactionInstruction({
    keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: false }],
    programId: verifier,
    data: Buffer.concat([
        Buffer.from([0]), // verify instruction
        witness
    ])
});

const tx = new Transaction().add(ix);
const sig = await connection.sendTransaction(tx, [wallet]);
await connection.confirmTransaction(sig);

console.log('✅ Proof verified on Solana!');
console.log('Signature:', sig);
TYPESCRIPT

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ℹ️  Full verification requires TypeScript/Rust client     ║"
echo "║                                                            ║"
echo "║  The witness is ready, but Solana verification needs:     ║"
echo "║  1. Proper proof format (UltraPlonk)                       ║"
echo "║  2. Backend proof generation (bb prove)                    ║"
echo "║  3. Transaction signing                                    ║"
echo "╚════════════════════════════════════════════════════════════╝"

