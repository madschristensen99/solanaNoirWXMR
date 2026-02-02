#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Noir ZK Proof Verification on Solana - Demo              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")/.."

# ============================================
# STEP 1: GENERATE PROOF
# ============================================
echo "🔐 Step 1: Generating Noir ZK Proof..."
echo ""

if [ ! -f "Prover.toml" ]; then
    echo "❌ Prover.toml not found!"
    echo "Please create Prover.toml with your Monero transaction data"
    exit 1
fi

echo "📝 Using Prover.toml:"
head -5 Prover.toml
echo "..."
echo ""

echo "🔧 Running: nargo prove"
nargo prove

if [ ! -f "proofs/noirSolana.proof" ]; then
    echo "❌ Proof generation failed!"
    exit 1
fi

PROOF_SIZE=$(wc -c < proofs/noirSolana.proof)
echo ""
echo "✅ Proof generated successfully!"
echo "   Size: $PROOF_SIZE bytes"
echo "   Location: proofs/noirSolana.proof"
echo ""

# ============================================
# STEP 2: VERIFY PROOF LOCALLY
# ============================================
echo "🔍 Step 2: Verifying Proof Locally..."
echo ""

echo "🔧 Running: nargo verify"
nargo verify

echo ""
echo "✅ Local verification passed!"
echo ""

# ============================================
# STEP 3: SHOW PROOF STRUCTURE
# ============================================
echo "📊 Step 3: Proof Structure..."
echo ""

echo "Proof bytes (hex):"
xxd -l 128 proofs/noirSolana.proof | head -8
echo "..."
echo ""

# ============================================
# STEP 4: SOLANA VERIFICATION INFO
# ============================================
echo "🌐 Step 4: Solana Verification Info..."
echo ""

VERIFIER_PROGRAM="Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy"
BRIDGE_PROGRAM="G6V8QRJi7H8APsuhGSmNaX8qLMRd4oW63y9UjCyRpEtr"

echo "Programs deployed on Solana Devnet:"
echo "   Verifier: $VERIFIER_PROGRAM"
echo "   Bridge:   $BRIDGE_PROGRAM"
echo ""

echo "To verify this proof on Solana, you would:"
echo ""
echo "1. Create a transaction with the proof data"
echo "2. Call the verifier program"
echo "3. The program validates the proof on-chain"
echo ""

# ============================================
# STEP 5: EXAMPLE SOLANA CALL
# ============================================
echo "📝 Step 5: Example Solana Verification Call..."
echo ""

cat << 'EOF'
// TypeScript example:
import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com');
const verifierProgram = new PublicKey('Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy');

// Read proof
const proof = fs.readFileSync('proofs/noirSolana.proof');

// Create verification instruction
const verifyIx = new TransactionInstruction({
    keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false }
    ],
    programId: verifierProgram,
    data: Buffer.concat([
        Buffer.from([0]), // Verify instruction
        proof
    ])
});

// Send transaction
const tx = new Transaction().add(verifyIx);
const signature = await connection.sendTransaction(tx, [wallet]);
await connection.confirmTransaction(signature);

console.log('✅ Proof verified on Solana!');
console.log('Signature:', signature);
EOF

echo ""

# ============================================
# STEP 6: CIRCUIT INFO
# ============================================
echo "📊 Step 6: Circuit Information..."
echo ""

if [ -f "target/noirSolana.json" ]; then
    GATES=$(jq '.num_acir_opcodes' target/noirSolana.json 2>/dev/null || echo "unknown")
    echo "Circuit complexity:"
    echo "   ACIR opcodes: $GATES"
    echo "   Proof system: UltraPlonk"
    echo "   Backend: Barretenberg"
else
    echo "   (Compile circuit with 'nargo compile' for details)"
fi

echo ""

# ============================================
# SUCCESS
# ============================================
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    ✅ DEMO COMPLETE!                       ║"
echo "║                                                            ║"
echo "║  1. ✅ Noir proof generated                                ║"
echo "║  2. ✅ Proof verified locally                              ║"
echo "║  3. ✅ Ready for Solana verification                       ║"
echo "║                                                            ║"
echo "║  Next steps:                                               ║"
echo "║  - Run verify-proof.ts to verify on Solana                ║"
echo "║  - Use the bridge frontend to mint zXMR                   ║"
echo "║  - Check DEPLOYMENT.md for full instructions              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
