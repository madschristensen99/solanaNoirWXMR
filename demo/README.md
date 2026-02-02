# Noir Proof Verification on Solana - Demo

This demo shows the complete flow of generating a Noir zero-knowledge proof and verifying it on Solana.

## 🎯 What This Demonstrates

1. **Generate Noir Proof**: Create a ZK proof for a Monero transaction
2. **Verify Locally**: Validate the proof using Nargo
3. **Verify on Solana**: Submit the proof to the deployed verifier program on Solana devnet
4. **Mint zXMR**: Use the verified proof to mint wrapped XMR tokens

## 🚀 Quick Start

### Prerequisites

```bash
# Install Noir
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Node.js dependencies (for TypeScript demo)
npm install @solana/web3.js
```

### Run the Demo

#### Option 1: Bash Script (Simple)

```bash
cd /home/remsee/solanaNoirWXMR
./demo/verify-proof.sh
```

This will:
- ✅ Compile the Noir circuit
- ✅ Execute the circuit with Prover.toml inputs
- ✅ Show proof structure
- ✅ Display Solana verification info

#### Option 2: TypeScript (Full Flow)

```bash
cd /home/remsee/solanaNoirWXMR/demo
npm install
ts-node verify-proof.ts
```

This will:
- ✅ Generate the proof
- ✅ Connect to Solana devnet
- ✅ Submit proof to verifier program
- ✅ Confirm on-chain verification

## 📊 Understanding the Flow

### 1. Noir Circuit (`src/main.nr`)

The circuit proves:
- You know the secret key `r` for a Monero transaction
- The transaction output belongs to you
- The amount is correctly decrypted
- All cryptographic relationships are valid

**Inputs:**
- Private: `tx_secret_key_r`, `amount_v`, `stealth_secret_H_s`
- Public: `one_time_address_R`, `tx_hash`, `output_index`, etc.

### 2. Proof Generation

```bash
# Compile circuit
nargo compile

# Execute with inputs from Prover.toml
nargo execute

# This creates: target/witness.gz
```

### 3. Proof Structure

The proof contains:
- **Commitments**: Cryptographic commitments to witness values
- **Evaluations**: Polynomial evaluations at challenge points
- **Opening proofs**: Proofs that commitments are correct
- **Public inputs**: Values visible on-chain

Size: ~2-4 KB (depending on circuit complexity)

### 4. Solana Verification

```typescript
// Create verification instruction
const verifyIx = new TransactionInstruction({
    keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false }
    ],
    programId: VERIFIER_PROGRAM_ID,
    data: Buffer.concat([
        Buffer.from([0]), // Instruction: verify
        proof,            // The ZK proof
        publicInputs      // Public values
    ])
});

// Send to Solana
const signature = await connection.sendTransaction(tx, [wallet]);
```

The verifier program:
1. Deserializes the proof
2. Checks proof structure
3. Verifies cryptographic commitments
4. Validates polynomial evaluations
5. Returns success/failure

**Cost**: ~400k compute units (~$0.04 on mainnet)

## 🔍 Proof Verification Steps

On Solana, the verifier performs:

1. **Parse proof bytes** → Extract commitments, evaluations, etc.
2. **Validate public inputs** → Check they match expected format
3. **Verify Fiat-Shamir** → Recompute challenge using transcript
4. **Check commitments** → Verify polynomial commitments
5. **Validate pairings** → Check cryptographic pairings (if using pairing-based SNARKs)
6. **Return result** → Success or failure

## 📝 Example Output

```
╔════════════════════════════════════════════════════════════╗
║  Noir ZK Proof Verification on Solana - Demo              ║
╚════════════════════════════════════════════════════════════╝

🔐 Step 1: Generating Noir ZK Proof...
   Transaction: 5caae835...c1439a
   Amount: 20 XMR
   ✅ Proof generated (2,847 bytes)

🔍 Step 2: Verifying Locally...
   ✅ Local verification passed

🌐 Step 3: Verifying on Solana...
   Connected to: https://api.devnet.solana.com
   Wallet: 7xK3...9mPq
   ✅ Transaction sent
   Signature: 4vJ9...2kL8
   ✅ PROOF VERIFIED ON-CHAIN!

╔════════════════════════════════════════════════════════════╗
║                    ✅ SUCCESS!                             ║
║  Proof verified on Solana devnet                           ║
╚════════════════════════════════════════════════════════════╝
```

## 🎓 Learn More

### Noir Circuit

- **File**: `/home/remsee/solanaNoirWXMR/src/main.nr`
- **Constraints**: ~617 ACIR opcodes
- **Proof System**: UltraPlonk
- **Backend**: Barretenberg

### Solana Programs

- **Verifier**: `Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy`
- **Bridge**: `G6V8QRJi7H8APsuhGSmNaX8qLMRd4oW63y9UjCyRpEtr`
- **Network**: Solana Devnet

### Resources

- [Noir Documentation](https://noir-lang.org/)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Protocol Spec](../PROTOCOL.md)
- [Deployment Guide](../DEPLOYMENT.md)

## 🐛 Troubleshooting

### "Proof generation failed"

- Check `Prover.toml` has valid inputs
- Ensure values are within BN254 field modulus
- Run `nargo check` to validate circuit

### "Solana transaction failed"

- Check wallet has SOL for fees
- Verify program ID is correct
- Check proof format matches verifier expectations

### "Verification failed"

- Ensure public inputs match what's in the proof
- Check proof wasn't corrupted
- Verify circuit and verifier are compatible versions

## 🎯 Next Steps

1. ✅ Run this demo
2. ✅ Understand the proof structure
3. ✅ Try modifying Prover.toml with your own values
4. ✅ Integrate with the bridge frontend
5. ✅ Deploy to mainnet (after audit!)

---

**Happy proving! 🎉**
