# Monero→Solana Bridge - TypeScript Client

TypeScript client for generating proofs and verifying them on Solana.

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Usage

### 1. Generate Proof Inputs

Generate a `Prover.toml` file from test transaction data:

```bash
# Use first transaction (TX1 - 20 XMR)
npm run generate-proof

# Use specific transaction by index
TX_INDEX=1 npm run generate-proof  # TX2 - 10 XMR
TX_INDEX=2 npm run generate-proof  # TX3 - 1.15 XMR
TX_INDEX=3 npm run generate-proof  # TX4 - 931 XMR (mainnet)
```

This will:
- Load transaction data from `../test_transactions.json`
- Compute witness values (R, S, P, H_s)
- Generate `../Prover.toml` with all circuit inputs

### 2. Generate Proof (using Nargo)

After generating `Prover.toml`, create the proof:

```bash
cd ..
nargo prove
```

This creates:
- `target/noirSolana.proof` - The ZK proof
- `target/noirSolana.pw` - Public witness data

### 3. Verify Proof On-Chain

Send the proof to Solana for verification:

```bash
# Set your verifier program ID
export VERIFIER_PROGRAM_ID=<your_deployed_verifier_address>

# Verify on devnet (default)
npm run verify

# Verify on mainnet
NETWORK=mainnet npm run verify
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TX_INDEX` | Transaction index from test_transactions.json | `0` |
| `NETWORK` | Solana network (devnet/mainnet) | `devnet` |
| `VERIFIER_PROGRAM_ID` | Deployed verifier program address | Required |
| `PROOF_PATH` | Path to proof file | `../target/noirSolana.proof` |
| `PUBLIC_WITNESS_PATH` | Path to public witness | `../target/noirSolana.pw` |
| `PAYER_KEYPAIR` | Path to payer keypair | `../keypair/deployer.json` |

## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run generate-proof` - Generate Prover.toml from test data
- `npm run verify` - Verify proof on Solana
- `npm test` - Run integration tests (coming soon)

## Example Workflow

```bash
# 1. Install dependencies
npm install

# 2. Build TypeScript
npm run build

# 3. Generate proof inputs for TX1 (20 XMR)
npm run generate-proof

# 4. Generate the proof
cd .. && nargo prove && cd client

# 5. Deploy verifier (first time only)
cd .. && just sunspot-deploy-devnet && cd client

# 6. Verify on Solana
export VERIFIER_PROGRAM_ID=<from_deployment>
npm run verify
```

## Integration with Monero

The current implementation uses placeholder values for Ed25519 point operations. For production:

1. **Fetch transaction data** from a Monero node:
   ```typescript
   const tx = await moneroRPC.getTransaction(txHash);
   const output = tx.outputs[outputIndex];
   ```

2. **Extract Ed25519 points**:
   - R (one-time address)
   - P (stealth address)
   - Encrypted amount

3. **Compute witness values**:
   - ECDH shared secret: S = 8·r·A
   - Stealth secret: H_s = H(r·A)
   - Decrypted amount: v = ecdhAmount ⊕ H(S)

4. **Generate commitment** using Pedersen hash

See `src/generateProof.ts` for the implementation structure.

## Files

- `src/verify.ts` - On-chain verification client
- `src/generateProof.ts` - Proof input generation
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration

## Dependencies

- `@solana/web3.js` - Solana blockchain interaction
- `@noble/ed25519` - Ed25519 cryptography
- `@noble/hashes` - Cryptographic hash functions
- `bs58` - Base58 encoding

## Security Notes

⚠️ **Important**:
- Never commit keypair files
- Never expose transaction secret keys
- Audit all cryptographic operations before mainnet
- Use secure RPC endpoints
- Validate all inputs

## License

MIT
