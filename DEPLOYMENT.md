# Monero→Solana Bridge - Deployment Guide

## 🎉 Devnet Deployment - January 23, 2026

### Deployed Programs

#### 1. Noir ZK Verifier
- **Program ID**: `Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy`
- **Network**: Solana Devnet
- **Transaction**: [View on Explorer](https://explorer.solana.com/tx/32kbBYXJjoKmGqh5FhSZKw5aTCDumSWCYkc1syN9qtcPrBSW1kZ6p1a6AEHR8zqHLcrSPevuKQC46PLBUSgMqMsC?cluster=devnet)
- **Binary**: `/home/remsee/noirSolana/target/noirSolana.so`
- **Keypair**: `/home/remsee/noirSolana/target/noirSolana-keypair.json`
- **Size**: ~216 KB
- **Constraints**: 617 ACIR opcodes
- **Compute Units**: ~400k CU per verification

#### 2. Bridge Program (Anchor)
- **Program ID**: `G6V8QRJi7H8APsuhGSmNaX8qLMRd4oW63y9UjCyRpEtr`
- **Network**: Solana Devnet
- **Transaction**: [View on Explorer](https://explorer.solana.com/tx/2heFLDbvaMNTxyJ4kV1XkWstcDkHB554bafWPJgHC6UaYYDgt8YzGfSqyD3EAKivM9nyxQQnm8NQhWiREEePPokU?cluster=devnet)
- **Binary**: `/home/remsee/noirSolana/bridge/target/deploy/bridge.so`
- **Keypair**: `/home/remsee/noirSolana/bridge/target/deploy/bridge-keypair.json`
- **Framework**: Anchor v0.31.1
- **Features**:
  - Initialize bridge with wXMR mint and USD1 collateral
  - LP registration with 150% collateralization
  - Mint wXMR with ZK proof verification
  - Burn wXMR to release collateral
  - Oracle Merkle root submission

### Oracle Infrastructure

#### Monero Wallet RPC
- **Version**: v0.18.4.5
- **Network**: Stagenet
- **Node**: http://node.monerodevs.org:38089
- **Wallet Address**: `5A74rdhLTsvHpgbSAeKnaQHAJ69btbwCpZa5mpxNGnab6eKz3G9TFEoKA8E2ezWXkF9fEh4wkfDCsKdbdbPkVaPqUXHgZqm`
- **Status**: Synced (145,222 blocks from height 1,895,520)
- **Balance**: 0.073 XMR (68 incoming transfers)

#### Components
- **Wallet RPC Client**: `/home/remsee/noirSolana/oracle/src/walletRpc.ts`
- **Monero RPC Client**: `/home/remsee/noirSolana/oracle/src/moneroClient.ts`
- **Merkle Tree Builder**: `/home/remsee/noirSolana/oracle/src/merkleTree.ts`
- **Solana Oracle Client**: `/home/remsee/noirSolana/oracle/src/oracleClient.ts`

## Build Process

### Noir Verifier

The verifier was built using a custom solution to overcome Rust toolchain compatibility issues:

```bash
cd /home/remsee/noirSolana
./deploy_engineered.sh
```

**Key Steps**:
1. Generate Cargo.lock with Rust 1.89 (supports edition2024)
2. Build with Solana's Rust 1.89 toolchain for `sbf-solana-solana` target
3. Deploy using `solana program deploy`

**Challenges Solved**:
- Cargo.lock version 4 incompatibility
- Edition2024 dependency requirements (blake3, zerocopy)
- Solana BPF toolchain Rust version mismatch

### Bridge Program

```bash
cd /home/remsee/noirSolana/bridge
./build_and_deploy.sh
```

**Build Configuration**:
- Workspace patches for compatible dependency versions
- Solana Rust 1.89 toolchain from `~/.cache/solana/v1.52/rust`
- Target: `sbf-solana-solana`
- Profile: release with LTO

## Testing

### Bridge Program Test Suite

Location: `/home/remsee/noirSolana/bridge/tests/bridge.ts`

**Test Flow**:
1. Initialize bridge with wXMR and USD1 mints
2. Register LP with 10,000 USD1 collateral
3. Oracle submits Merkle root for block 1,900,000
4. User mints 0.05 wXMR with ZK proof
5. User burns wXMR to release collateral

**Run Tests**:
```bash
cd /home/remsee/noirSolana/bridge
anchor test --skip-build --skip-deploy --provider.cluster devnet
```

### Oracle Test Suite

Location: `/home/remsee/noirSolana/oracle/src/test/fullTest.ts`

**Test Flow**:
1. Connect to wallet RPC
2. Restore wallet from mnemonic seed
3. Sync with blockchain
4. Fetch incoming transactions
5. Build Merkle tree from block outputs
6. Generate and verify Merkle proofs

**Run Tests**:
```bash
cd /home/remsee/noirSolana/oracle
npm run test:full
```

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    User (Browser/Wallet)                     │
│  - Generate ZK proof with Noir                               │
│  - Submit proof + Merkle data to Solana                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Noir ZK Verifier (Solana Program)               │
│  Program ID: Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy  │
│  - Verifies UltraPlonk proofs on-chain                       │
│  - ~400k compute units per verification                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│               Bridge Program (Anchor)                        │
│  Program ID: G6V8QRJi7H8APsuhGSmNaX8qLMRd4oW63y9UjCyRpEtr  │
│  - Manages LP collateral (USD1)                              │
│  - Mints/burns wXMR tokens                                   │
│  - Verifies Merkle roots from oracle                         │
│  - Enforces 150% collateralization                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  Oracle Infrastructure                       │
│  - Monero Wallet RPC (v0.18.4.5)                            │
│  - Merkle tree builder (SHA256)                              │
│  - Transaction fetching                                      │
│  - Submits Merkle roots to Solana                            │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User sends XMR** → Monero stagenet
2. **Oracle detects transaction** → Builds Merkle tree
3. **Oracle submits Merkle root** → Solana bridge program
4. **User generates ZK proof** → Proves ownership without revealing secret key
5. **User submits proof** → Solana verifier validates
6. **Bridge mints wXMR** → User receives wrapped XMR on Solana
7. **User burns wXMR** → LP releases collateral

## Configuration

### Environment Variables

```bash
# Solana
SOLANA_NETWORK=devnet
VERIFIER_PROGRAM_ID=Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy
BRIDGE_PROGRAM_ID=G6V8QRJi7H8APsuhGSmNaX8qLMRd4oW63y9UjCyRpEtr

# Monero
MONERO_NETWORK=stagenet
MONERO_DAEMON_URL=http://node.monerodevs.org:38089
WALLET_RPC_URL=http://localhost:38083

# Bridge Parameters
COLLATERAL_RATIO=150  # 150%
LIQUIDATION_THRESHOLD=120  # 120%
MINT_FEE_BPS=30  # 0.3%
BURN_FEE_BPS=30  # 0.3%
```

### Program Addresses

```typescript
// Solana Devnet
export const PROGRAMS = {
  verifier: new PublicKey("Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy"),
  bridge: new PublicKey("G6V8QRJi7H8APsuhGSmNaX8qLMRd4oW63y9UjCyRpEtr"),
};

// Pyth Oracle (XMR/USD)
export const PYTH_XMR_USD = new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix");
```

## Next Steps

### For Testing
1. ✅ Programs deployed to devnet
2. ✅ Oracle infrastructure operational
3. ⏳ Generate real ZK proof from Monero transaction
4. ⏳ Execute full bridge flow (LP → Mint → Burn)
5. ⏳ Test with multiple LPs and users

### For Production
1. ⏳ Security audit of ZK circuit
2. ⏳ Security audit of Solana programs
3. ⏳ Stress testing and optimization
4. ⏳ Mainnet deployment
5. ⏳ Liquidity provider onboarding
6. ⏳ User interface development

## Troubleshooting

### Build Issues

**Problem**: Cargo.lock version 4 error
```
error: lock file version 4 requires `-Znext-lockfile-bump`
```

**Solution**: Use Rust 1.89 to generate lockfile:
```bash
cargo +1.89 generate-lockfile
```

**Problem**: Edition2024 dependency errors
```
error: feature `edition2024` is required
```

**Solution**: Add dependency patches in Cargo.toml:
```toml
[patch.crates-io]
blake3 = { git = "https://github.com/BLAKE3-team/BLAKE3", tag = "1.5.0" }
```

### Deployment Issues

**Problem**: Insufficient funds for deployment
```
Error: Account has insufficient funds
```

**Solution**: Request airdrop:
```bash
solana airdrop 5 --url devnet
```

### Oracle Issues

**Problem**: Wallet RPC SSL verification failure
```
SSL peer has not been verified
```

**Solution**: Use HTTP node instead of HTTPS:
```bash
MONERO_DAEMON_URL=http://node.monerodevs.org:38089
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/FUNGERBIL/noirSolana/issues
- Protocol Spec: [PROTOCOL.md](./PROTOCOL.md)
- README: [README.md](./README.md)

---

**Last Updated**: January 23, 2026  
**Deployment Status**: ✅ Devnet Live  
**Mainnet Status**: ⏳ Pending Audit
