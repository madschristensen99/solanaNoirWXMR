#!/bin/bash

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Noir ZK Proof → Solana Verification Demo              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

cd /home/remsee/solanaNoirWXMR

# ============================================
# STEP 1: COMPILE CIRCUIT
# ============================================
echo "🔧 Step 1: Compiling Noir Circuit..."
echo ""

nargo compile

if [ $? -eq 0 ]; then
    echo "✅ Circuit compiled successfully!"
    
    # Show circuit info
    if [ -f "target/noirSolana.json" ]; then
        GATES=$(jq -r '.functions[0].opcodes | length' target/noirSolana.json 2>/dev/null || echo "unknown")
        echo "   ACIR opcodes: $GATES"
    fi
else
    echo "❌ Compilation failed"
    exit 1
fi

echo ""

# ============================================
# STEP 2: EXECUTE CIRCUIT
# ============================================
echo "🔐 Step 2: Executing Circuit (Generating Witness)..."
echo ""

nargo execute

if [ $? -eq 0 ]; then
    echo "✅ Witness generated!"
    
    if [ -f "target/witness.gz" ]; then
        SIZE=$(wc -c < target/witness.gz)
        echo "   Witness size: $SIZE bytes"
    fi
else
    echo "❌ Execution failed"
    exit 1
fi

echo ""

# ============================================
# STEP 3: SHOW VERIFICATION INFO
# ============================================
echo "🌐 Step 3: Solana Verification Info"
echo ""

VERIFIER="Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy"
BRIDGE="G6V8QRJi7H8APsuhGSmNaX8qLMRd4oW63y9UjCyRpEtr"

echo "Deployed Programs (Solana Devnet):"
echo "   🔐 Verifier: $VERIFIER"
echo "   🌉 Bridge:   $BRIDGE"
echo ""

echo "To verify this proof on Solana:"
echo ""
echo "1. The witness proves you know the Monero transaction secret"
echo "2. Submit to Solana verifier program"
echo "3. Program validates the proof on-chain"
echo "4. If valid, you can mint zXMR tokens"
echo ""

# ============================================
# STEP 4: SHOW EXAMPLE CODE
# ============================================
echo "📝 Step 4: Example Verification Code"
echo ""

cat << 'EOF'
// Solana verification (TypeScript):

import { Connection, PublicKey, Transaction } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com');
const verifier = new PublicKey('Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy');

// Read witness
const witness = fs.readFileSync('target/witness.gz');

// Create verification transaction
const tx = await createVerifyTransaction(verifier, witness);

// Send to Solana
const sig = await connection.sendTransaction(tx, [wallet]);
console.log('✅ Verified on Solana!', sig);
EOF

echo ""
echo ""

# ============================================
# SUCCESS
# ============================================
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                  ✅ DEMO COMPLETE!                         ║"
echo "║                                                            ║"
echo "║  ✅ Circuit compiled                                       ║"
echo "║  ✅ Witness generated                                      ║"
echo "║  ✅ Ready for Solana verification                          ║"
echo "║                                                            ║"
echo "║  Files created:                                            ║"
echo "║  - target/noirSolana.json (circuit)                        ║"
echo "║  - target/witness.gz (proof witness)                       ║"
echo "║                                                            ║"
echo "║  Next: Use the frontend or TypeScript to verify on-chain  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
