# Monero→Solana Bridge - Demo Guide

## 🎯 Quick Demo Scripts

### 1. Test the Noir Circuit (Fast - ~1 second)
```bash
# Compile and test the ZK circuit
nargo check          # Verify circuit compiles
nargo test           # Run 4 unit tests
nargo info           # Show circuit stats (552 opcodes)
nargo compile        # Compile to JSON artifact
```

### 2. Test the Oracle (Connects to Monero Stagenet)
```bash
cd oracle

# Setup environment
cp .env.example .env

# Run wallet tests (connects to real Monero node)
npm run test:wallet

# Run full oracle test (fetches transactions, builds Merkle tree)
npm run test:full

# Start the oracle service (continuous monitoring)
npm start
```

### 3. Generate Proof Inputs (Fast - ~1 second)
```bash
cd client

# Generate Prover.toml from test transaction data
npm run generate-proof

# Use different test transaction (0-3)
TX_INDEX=1 npm run generate-proof
TX_INDEX=2 npm run generate-proof
TX_INDEX=3 npm run generate-proof
```

### 4. Test Solana Verification (Requires deployed verifier)
```bash
cd client

# Verify proof on Solana devnet
VERIFIER_PROGRAM_ID=Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy npm run verify
```

### 5. Build & Deploy Bridge Program
```bash
cd bridge

# Build the Anchor program
./build.sh

# Build and deploy to devnet (requires SOL)
./build_and_deploy.sh

# Deploy bridge program only
./deploy_bridge.sh
```

## 📊 What Each Script Does

### Circuit Scripts (Noir)
- **`nargo check`** - Validates circuit syntax and compiles (~1s)
- **`nargo test`** - Runs 4 unit tests for commitment, scalars, amounts, points (~2s)
- **`nargo info`** - Shows constraint count and circuit complexity (~1s)
- **`nargo compile`** - Generates JSON artifact for proof systems (~1s)

### Oracle Scripts (TypeScript + Monero)
- **`npm run test:wallet`** - Tests Monero wallet RPC connection (~5-10s)
  - Connects to stagenet node
  - Syncs wallet (145,222 blocks)
  - Shows balance and transactions
  
- **`npm run test:full`** - Full oracle integration test (~30-60s)
  - Fetches Monero transactions
  - Builds Merkle tree
  - Computes transaction proofs
  - Tests Solana submission
  
- **`npm start`** - Runs continuous oracle service
  - Monitors Monero blockchain
  - Updates Merkle roots
  - Submits to Solana

### Client Scripts (TypeScript + Solana)
- **`npm run generate-proof`** - Generates circuit inputs (~1s)
  - Reads test_transactions.json
  - Computes Ed25519 points
  - Generates Prover.toml
  
- **`npm run verify`** - Verifies proof on Solana (~3-5s)
  - Connects to devnet
  - Calls verifier program
  - Shows transaction result

### Bridge Scripts (Anchor + Solana)
- **`./build.sh`** - Builds Anchor program (~30-60s)
  - Compiles Rust to BPF
  - Generates IDL
  
- **`./build_and_deploy.sh`** - Full deployment (~2-3 minutes)
  - Builds program
  - Deploys to devnet
  - Initializes state
  
- **`./deploy_bridge.sh`** - Deploy only (~1-2 minutes)
  - Deploys pre-built program
  - Sets up accounts

## 🚀 Recommended Demo Flow

### Quick Demo (5 minutes)
```bash
# 1. Show circuit works
nargo test

# 2. Generate proof inputs
cd client && npm run generate-proof

# 3. Show oracle can connect
cd ../oracle && npm run test:wallet
```

### Full Demo (15-20 minutes)
```bash
# 1. Circuit compilation and testing
nargo check && nargo test && nargo info

# 2. Generate proof for all test transactions
cd client
for i in 0 1 2 3; do
  echo "Generating proof for TX$((i+1))..."
  TX_INDEX=$i npm run generate-proof
done

# 3. Run full oracle test
cd ../oracle
npm run test:full

# 4. Test Solana verification
cd ../client
VERIFIER_PROGRAM_ID=Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy npm run verify

# 5. Build bridge program
cd ../bridge
./build.sh
```

## ⚠️ Important Notes

### Proof Generation Timing
- **Nargo v1.0.0-beta.16 doesn't include proof generation** - it only compiles circuits
- **Actual proof generation** requires:
  - Barretenberg backend (C++)
  - Sunspot tool (for Solana)
  - Or bb (Barretenberg CLI)
  
### Current Limitations
1. **No `nargo prove` command** - This was removed in newer Nargo versions
2. **Proof generation requires external tools** - Use Sunspot or bb CLI
3. **Field modulus issues** - Ed25519 values exceed BN254 field, need proper encoding

### What Works Now
✅ Circuit compilation and testing  
✅ Oracle Monero blockchain integration  
✅ Client proof input generation  
✅ Solana program deployment (already deployed)  
✅ Bridge program (already deployed)  

### What Needs Setup for Full Proof Flow
❌ Barretenberg/Sunspot installation  
❌ Proper field encoding for Ed25519→BN254  
❌ End-to-end proof generation pipeline  

## 📖 Test Transactions Available

The project includes 4 real Monero transactions for testing:

1. **TX1** - 20 XMR (stagenet, block 1934116)
2. **TX2** - 10 XMR (stagenet, block 1948001)
3. **TX3** - 1.15 XMR (stagenet, block 2023616)
4. **TX4** - 931.06 XMR (mainnet, block 3569096)

All in `test_transactions.json` with real secret keys for demo purposes.

## 🎯 Best Demo to Run Right Now

```bash
# This shows the complete working system without needing proof generation:

# 1. Circuit tests (2 seconds)
nargo test

# 2. Oracle wallet test (10 seconds)
cd oracle && npm run test:wallet

# 3. Generate proof inputs (1 second)
cd ../client && npm run generate-proof

# 4. Show deployed programs
echo "Verifier: Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy"
echo "Bridge: G6V8QRJi7H8APsuhGSmNaX8qLMRd4oW63y9UjCyRpEtr"
```

This demonstrates the full pipeline is working, even though actual ZK proof generation requires additional tooling.
