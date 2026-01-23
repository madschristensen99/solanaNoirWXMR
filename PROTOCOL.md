# Monero→Solana Bridge Specification v7.1

*Noir ZK Architecture | Pyth Oracle | USD1 Collateral*

**Current: ~617 constraints | Output Merkle Tree | zkTLS-ready | 150% initial collateral | 120% liquidation threshold | USD1-only**

**Platform: Solana Mainnet (Target) | Solana Devnet (Testnet)**

**Status: ✅ Noir Circuit Working | ✅ Output Merkle Tree Implemented | ✅ ~400k CU | ⚠️ Requires Security Audit**

---

## 1. Architecture & Principles

### 1.1 Core Design Tenets

1. **Cryptographic Layer (Noir-Optimized)**: Off-chain Ed25519 operations (R=r·G, S=8·r·A, P=H_s·G+B) using @noble/ed25519. In-circuit Poseidon commitment binding all witness values (~617 constraints). Noir's native field arithmetic enables efficient constraint generation. Poseidon commitment cryptographically binds r, v, H_s, R_x, S_x, P—making DLEQ verification redundant. Status: ✅ End-to-end proof working | ⚠️ Requires audit

2. **Economic Layer (Solana Programs)**: Enforces USD1-only collateralization via Anchor programs, manages liquidity risk, Pyth-protected liquidations with real-time price feeds and configurable staleness thresholds.

3. **Oracle Layer (Pyth Network)**: Real-time price feeds with confidence intervals, EMA pricing for liquidation protection, cross-chain price attestations with sub-second latency. Quadratic-weighted N-of-M consensus for Monero transaction attestation.

4. **Privacy Transparency**: Single-key verification model; destination address provided as explicit input.

5. **Minimal Governance**: No admin elections, no Snapshot. Single guardian multisig can pause mints only (30-day timelock to unpause). All other parameters immutable at deployment.

### 1.2 System Components

```
┌─────────────────────────────────────────────────────────────┐
│              User Frontend (Browser/Wallet)                  │
│  - Paste tx secret key (r) from wallet                       │
│  - Paste tx hash + output index                              │
│  - Enter LP address (A, B) + amount                          │
│  - Fetch transaction data from Monero node                   │
│  - Fetch Merkle proofs (TX + output) from oracle/node       │
│  - Generate Ed25519 operations (R, S, P) - @noble/ed25519   │
│  - Generate DLEQ proof (c, s, K1, K2)                        │
│  - Generate Noir proof (~617 constraints, Barretenberg)      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│      Security-Hardened Circuit (Noir, ~617 constraints)     │
│  Proves:                                                     │
│    - Poseidon commitment binding witness values             │
│    - Amount decryption correctness (v XOR ecdhAmount)       │
│    - Stealth address derivation (P = H_s·G + B)             │
│    - Scalar range checks (r < L, H_s < L)                   │
│    - 64-bit amount range check (v < 2^64)                   │
│    - Point validation and decompression                      │
│                                                              │
│  ⚠️  Requires security audit                                │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│         Ed25519 DLEQ Verification (Solana Program)          │
│  Verifies:                                                   │
│    - DLEQ proof: log_G(R) = log_A(rA) = r                   │
│    - Ed25519 point operations using native instructions     │
│    - Challenge: c = H(G, A, R, rA, K1, K2) mod L            │
│    - Response: s·G = K1 + c·R  AND  s·A = K2 + c·rA        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Output Merkle Tree Verification                 │
│  Verifies:                                                   │
│    - TX exists in block (txMerkleRoot)                      │
│    - Output data authentic (outputMerkleRoot)               │
│    - Leaf = Hash(txHash||index||ecdhAmount||pubKey||commit) │
│    - Prevents amount fraud (ecdhAmount verified)            │
│                                                              │
│  ✅ zkTLS-ready: One proof per block (not per TX)           │
│  ✅ No oracle liveness per transaction                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│           Solana Noir Verifier (Barretenberg)               │
│  - Verifies UltraPlonk proofs on-chain                      │
│  - ~400k compute units per verification                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Anchor Bridge Program (~2,500 LOC)             │
│  - Manages LP collateral (USD1 only)                        │
│  - Quadratic-weighted N-of-M consensus (min 3.0 votes)      │
│  - Pyth oracle integration (real-time + EMA)                │
│  - Enforces 150% collateralization (120% liquidation)       │
│  - Oracle rewards from fees + accuracy bonuses              │
│  - On-chain node registry (max 1 change/week)               │
│  - Guardian pause (mints only, 30-day unpause timelock)     │
│  - Oracle bonding (slashable for provably false proofs)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Zero-Knowledge Proof System

### 2.1 Noir Circuit Overview

The MoneroBridge Noir circuit (~617 constraints) cryptographically proves:

1. **Secret Key Knowledge**: Proves r·G = R without revealing r
2. **Destination Correctness**: Proves funds sent to LP address (A, B)
3. **Amount Verification**: Decrypts and verifies ecdhAmount matches claimed value

**Key Properties:**
- Client-side witness generation (browser-based)
- UltraPlonk proof system with universal setup (no trusted ceremony needed)
- Replay protection via on-chain tx_hash tracking
- Noir's Rust-like syntax enables cleaner cryptographic implementations

### 2.2 Noir vs Circom Comparison

| Feature | Noir | Circom |
|---------|------|--------|
| Language | Rust-like, type-safe | JavaScript-like DSL |
| Proving System | UltraPlonk/Barretenberg | Groth16/PLONK |
| Setup | Universal (no ceremony) | Circuit-specific trusted setup |
| Recursion | Native support | Complex implementation |
| Solana Support | Native via Verifier SDK | Requires custom integration |
| Constraint Efficiency | ~617 for this circuit | ~1157 for equivalent |
| Developer Experience | Cargo-based tooling | Custom toolchain |

### 2.3 Proof Generation Flow

1. **Fetch Transaction Data**: Retrieve Monero tx from registered node
2. **Validate Confirmations**: Require 10+ block confirmations (~20 minutes)
3. **Compute Witnesses**: Generate circuit inputs (secret key, amount, addresses)
4. **Generate Noir Proof**: Create UltraPlonk proof client-side using Barretenberg WASM
5. **Submit to Solana**: Send proof + public inputs to bridge program

### 2.4 Output Merkle Tree Architecture

**Problem Solved**: Prevents amount fraud without requiring oracle liveness per transaction.

**How It Works:**

1. **Oracle Posts Blocks** (every ~2 minutes):
   - Fetches Monero block from RPC
   - Extracts all transaction outputs
   - Computes two Merkle roots:
     - `txMerkleRoot`: Merkle root of all TX hashes (proves TX exists)
     - `outputMerkleRoot`: Merkle root of all output data (proves amounts authentic)
   - Posts to Solana program: `(blockHeight, blockHash, txMerkleRoot, outputMerkleRoot)`

2. **User Submits Proof**:
   - Fetches output data from any Monero node
   - Fetches Merkle proofs (TX proof + output proof)
   - Submits: `(noirProof, outputData, txMerkleProof, outputMerkleProof)`

3. **Program Verifies**:
   - TX exists in block (via txMerkleProof)
   - Output data is authentic (via outputMerkleProof)
   - ecdhAmount matches oracle-posted data
   - Noir proof proves ownership

**Merkle Leaf Structure:**
```rust
leaf = keccak256(
    tx_hash,
    output_index,
    ecdh_amount,      // CRITICAL: Prevents amount fraud
    output_pub_key,
    commitment
)
```

**Benefits:**
- ✅ **No oracle liveness per TX**: Oracle posts once per block
- ✅ **Amount fraud impossible**: ecdhAmount committed in Merkle tree
- ✅ **zkTLS-ready**: One zkTLS proof covers entire block
- ✅ **Scalable**: Unlimited transactions per block
- ✅ **User autonomy**: Can get data from any Monero node

**Costs:**
- Oracle: ~100k CU per block post (every 2 min)
- User: ~50k CU for Merkle proofs + ~400k CU for Noir proof

### 2.5 Circuit Technical Summary

| Parameter | Value |
|-----------|-------|
| Constraint Count | ~617 |
| Proof System | UltraPlonk |
| Prover | Barretenberg (WASM/native) |
| Key Operations | Ed25519 scalar mult, Poseidon hash |
| Optimization | H_s_scalar precomputed off-circuit |
| Merkle Trees | Dual-root system (TX + output) |

---

## 3. Economic Model & Collateralization

### 3.1 USD1 Collateral System

USD1 serves as the exclusive collateral for the bridge, providing stable backing for wrapped XMR tokens. USD1's on-chain transparency and regulatory compliance make it ideal for DeFi bridge collateralization.

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Initial Collateral | 150% | Buffer against XMR volatility |
| Liquidation Threshold | 120% | Full position takeover trigger |
| Accepted Collateral | USD1 only | Stable, regulated stablecoin |
| Collateral Custody | Non-custodial | LPs maintain control via PDAs |

### 3.2 Pyth Oracle Integration

Pyth Network provides real-time, high-fidelity price feeds for XMR/USD with confidence intervals and exponential moving averages. This replaces the TWAP-based approach used in EVM chains.

**Pyth Configuration:**

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Price Feed | XMR/USD | Primary valuation |
| Confidence Interval | Used for liquidations | Prevents manipulation |
| EMA Period | 15 minutes (configurable) | Smoothed pricing |
| Staleness Threshold | 60 seconds | Reject stale prices |
| Fallback | EMA price | If spot unavailable |

**Price Validation Rules:**
- Price age must be < staleness_threshold (60s default)
- Confidence interval must be < 2% of price for liquidations
- EMA price used when confidence is wide
- Program rejects transactions with stale or low-confidence prices

### 3.3 Liquidation Mechanics

**Full Position Takeover Model:** When an LP position falls to or below 120% collateralization, any user can liquidate and assume the entire position. This is not a partial liquidation—the liquidator takes over the full collateral and minted wXMR obligations.

| Tier | Collateral Ratio | Status | What Happens |
|------|------------------|--------|--------------|
| **Healthy** | >120% | ✅ Normal | All operations permitted |
| **Liquidatable** | ≤120% | 🔴 At Risk | Anyone can take over entire position |

**Liquidation Process:**
1. Liquidator calls `liquidate(lp_position)` with Pyth price verification
2. Program confirms collateral ratio ≤ 120% using Pyth EMA price
3. **Entire position transfers to liquidator:**
   - All USD1 collateral in the position
   - All wXMR debt obligations
4. Original LP loses their position completely
5. Liquidator now responsible for maintaining 120%+ ratio

**Why Full Takeover?**
- **Simplicity**: No complex partial liquidation math or cascading liquidations
- **Strong incentive**: LPs are highly motivated to maintain healthy ratios
- **Immediate resolution**: Underwater positions are fully resolved in one transaction
- **Liquidator alignment**: New owner has full collateral to manage the position

**Example:**
```
LP Position: 1,500 USD1 collateral / 10 wXMR debt
XMR price drops: Position now at 118% ratio

Liquidator calls liquidate():
  → Receives: 1,500 USD1 collateral
  → Assumes: 10 wXMR debt obligation
  → Original LP: Loses entire position

Liquidator can now:
  - Add more collateral to strengthen position
  - Wait for price recovery
  - Burn wXMR to close position and reclaim USD1
```

### 3.4 Oracle Consensus Model

**Quadratic-Weighted N-of-M Voting:**
- Minimum 3.0 weighted votes required for proof acceptance
- Oracle reputation score based on historical accuracy
- Vote weight = (reputation_score)²
- Slashing for provably false attestations

**Oracle Requirements:**
- Minimum 1,000 USD1 bond (slashable)
- Run registered Monero node
- Verify Noir proofs
- Attest to transaction validity

**Weight Calculation:**

Formula: `weight = sqrt(accuracy × experienceMultiplier)`

Where `experienceMultiplier = 1 + min(proofsSubmitted / 10, 2)`

| Oracle State | Accuracy | Proofs | Experience | Combined | Weight |
|--------------|----------|--------|------------|----------|--------|
| **New** | 100% | 0 | 1.0× | 1.00 | 1.00 |
| **Active** | 100% | 20 | 1.2× | 1.20 | 1.10 |
| **Experienced** | 100% | 50 | 1.5× | 1.50 | 1.22 |
| **Veteran** | 100% | 100+ | 2.0× | 2.00 | 1.41 |
| **Slashed 1×** | 75% | 100+ | 2.0× | 1.50 | 1.22 |
| **Slashed 2×** | 50% | 100+ | 2.0× | 1.00 | 1.00 |
| **Slashed 3×** | 25% | 100+ | 2.0× | 0.50 | 0.71 |
| **Slashed 4×** | 0% | 100+ | 2.0× | 0.00 | 0.00 |

**Example Consensus Scenarios:**
- 3 new oracles: 1.0 + 1.0 + 1.0 = 3.0 ✅
- 2 veterans + 1 new: 1.41 + 1.41 + 1.0 = 3.82 ✅
- 2 new oracles: 1.0 + 1.0 = 2.0 ❌
- 1 veteran + 1 slashed-2×: 1.41 + 1.0 = 2.41 ❌

### 3.5 Fee Structure

| Fee Type | Amount | Recipient |
|----------|--------|-----------|
| Mint Fee | 0.3% | LP Pool |
| Burn Fee | 0.3% | LP Pool |
| Oracle Rewards | From fees | Active oracles (accuracy-weighted) |
| LP Yield | Fees + protocol revenue | Liquidity providers |

### 3.6 LP Position Example

```
User deposits: 10 XMR @ $150 = $1,500 value
LP required collateral: $1,500 × 1.50 = $2,250 USD1

LP posts: 2,250 USD1 to vault PDA
Bridge fees: 0.3% on mint/burn = ~$9/year per 10 XMR cycled
Oracle share: 10% of fees
LP net: 90% of fees + any protocol incentives
```

---

## 4. Solana Program Architecture

### 4.1 Program Overview

The bridge is implemented as an Anchor program on Solana, leveraging native SPL token support and Pyth oracle integration.

| Component | Description | Key Accounts |
|-----------|-------------|--------------|
| Noir Verifier | On-chain proof verification | Verification key PDA |
| Bridge Core | Mint/burn/liquidate logic | Bridge state, LP positions |
| Collateral Manager | USD1 custody and liquidations | Vault PDAs, user positions |
| Oracle Registry | Weighted consensus tracking | Oracle accounts, reputation |

### 4.2 Account Structure

```rust
// Bridge State PDA
#[account]
pub struct BridgeState {
    pub authority: Pubkey,           // Guardian multisig
    pub wxmr_mint: Pubkey,           // wXMR SPL token mint
    pub usd1_mint: Pubkey,           // USD1 collateral mint
    pub vault: Pubkey,               // USD1 vault PDA
    pub pyth_feed: Pubkey,           // XMR/USD price feed
    pub total_minted: u64,           // Total wXMR in circulation
    pub total_collateral: u64,       // Total USD1 locked
    pub paused: bool,                // Emergency pause flag
    pub bump: u8,
}
// seeds = [b"bridge", wxmr_mint.key()]

// LP Position PDA
#[account]
pub struct LpPosition {
    pub owner: Pubkey,               // LP authority
    pub collateral_amount: u64,      // USD1 deposited
    pub minted_amount: u64,          // wXMR minted against this position
    pub last_update: i64,            // Timestamp
    pub bump: u8,
}
// seeds = [b"lp", bridge.key(), owner.key()]

// Oracle Account
#[account]
pub struct OracleAccount {
    pub authority: Pubkey,           // Oracle operator
    pub bond_amount: u64,            // USD1 bonded
    pub accuracy_score: u16,         // Basis points (10000 = 100%)
    pub proofs_submitted: u32,       // Historical count
    pub slashes: u8,                 // Number of slashing events
    pub monero_node: String,         // Registered node URL
    pub bump: u8,
}
// seeds = [b"oracle", bridge.key(), authority.key()]

// Merkle Root Storage
#[account]
pub struct BlockRoot {
    pub block_height: u64,
    pub block_hash: [u8; 32],
    pub tx_merkle_root: [u8; 32],
    pub output_merkle_root: [u8; 32],
    pub timestamp: i64,
    pub submitter: Pubkey,
}
// seeds = [b"block", bridge.key(), block_height.to_le_bytes()]
```

### 4.3 Key Instructions

```rust
// Initialize bridge with verification key
pub fn initialize(
    ctx: Context<Initialize>,
    verification_key: Vec<u8>,
) -> Result<()>

// Register as liquidity provider
pub fn register_lp(
    ctx: Context<RegisterLp>,
    collateral_amount: u64,
) -> Result<()>

// Mint wXMR with Noir proof
pub fn mint(
    ctx: Context<Mint>,
    proof: Vec<u8>,
    public_inputs: Vec<u8>,
    tx_merkle_proof: Vec<[u8; 32]>,
    output_merkle_proof: Vec<[u8; 32]>,
    output_data: OutputData,
) -> Result<()>

// Burn wXMR and initiate release
pub fn burn(
    ctx: Context<Burn>,
    amount: u64,
    monero_address: String,
) -> Result<()>

// Liquidate and take over undercollateralized position
pub fn liquidate(
    ctx: Context<Liquidate>,
    lp_position: Pubkey,
) -> Result<()>
// Transfers entire position (collateral + debt) to liquidator

// Oracle submits block roots
pub fn submit_block_root(
    ctx: Context<SubmitBlockRoot>,
    block_height: u64,
    block_hash: [u8; 32],
    tx_merkle_root: [u8; 32],
    output_merkle_root: [u8; 32],
) -> Result<()>

// Oracle votes on transaction validity
pub fn submit_vote(
    ctx: Context<SubmitVote>,
    tx_hash: [u8; 32],
    valid: bool,
) -> Result<()>
```

### 4.4 Compute Budget

| Instruction | Compute Units | Notes |
|-------------|---------------|-------|
| `initialize` | ~50,000 CU | One-time setup |
| `register_lp` | ~80,000 CU | Account creation + transfer |
| `mint` | ~400,000 CU | Noir verification dominates |
| `burn` | ~50,000 CU | Token burn + state update |
| `liquidate` | ~150,000 CU | Pyth price + position transfer |
| `submit_block_root` | ~100,000 CU | Merkle root storage |
| `submit_vote` | ~30,000 CU | Signature + state update |

---

## 5. Performance Targets

### 5.1 Proving Times

| Environment | Time | Memory | Notes |
|-------------|------|--------|-------|
| **Browser (WASM)** | 2.0-3.0s | ~800 MB | Barretenberg WASM |
| **Browser (WebGPU)** | 1.2-1.8s | ~500 MB | Chrome 120+ |
| **Native (nargo)** | 0.3-0.6s | ~400 MB | 8-core CPU |
| **Mobile (iOS)** | 3.0-4.0s | ~1.0 GB | iPhone 15 Pro |

### 5.2 Transaction Costs (Solana)

| Instruction | Compute Units | Cost @ Priority | Notes |
|-------------|---------------|-----------------|-------|
| `register_lp` | 80,000 CU | ~$0.008 | Account creation |
| `submit_vote` | 30,000 CU | ~$0.003 | Oracle attestation |
| `mint` | 400,000 CU | ~$0.04 | Noir verification |
| `burn` | 50,000 CU | ~$0.005 | Token burn |
| `liquidate` | 150,000 CU | ~$0.015 | Position takeover |
| `submit_block_root` | 100,000 CU | ~$0.01 | Per block (~2 min) |

### 5.3 Comparison: Solana vs EVM

| Metric | Solana | Arbitrum/Base |
|--------|--------|---------------|
| Mint Cost | ~$0.04 | ~$1.45 |
| Settlement Time | ~400ms | ~12 seconds |
| Proof Verification | ~400k CU | ~137k gas |
| Block Time | 400ms | 2-12 seconds |
| Throughput | 65k TPS theoretical | ~100-1000 TPS |

---

## 6. Security Analysis

### 6.1 Attack Cost Matrix

| Attack Vector | Requirements | Cost | Mitigation |
|---------------|--------------|------|------------|
| **3 Sybil Oracles** | 3× 1,000 USD1 bonds | 3,000 USD1 | Slashed if detected |
| **Price Manipulation** | Manipulate Pyth feed | Economically infeasible | Confidence intervals + EMA |
| **Flash Loan Takeover** | Flash loan to liquidate | Blocked | Must maintain position post-liquidation |
| **Oracle Majority** | >50% weighted votes | Variable | Quadratic weighting degrades influence |
| **Circuit Bug Exploit** | Zero-day in Noir circuit | Unknown | Guardian pause available |
| **Replay Attack** | Reuse valid proof | Blocked | On-chain tx_hash tracking |

### 6.2 Trust Assumptions

1. **Pyth Network**: Trusted for spot prices; confidence intervals and EMA provide manipulation resistance. Pyth's decentralized publisher network adds redundancy.

2. **3+ Honest Oracles**: Required for consensus on Monero transaction validity. Quadratic weighting ensures experienced honest oracles have disproportionate influence.

3. **Guardian Multisig**: Can only pause mints; 30-day unpause delay provides time for community response to any malicious pause.

4. **Noir Circuit Correctness**: Pre-mainnet audits required. Formal verification with tools like Ecne recommended for critical paths.

5. **Monero Nodes**: N-of-M node consensus with TLS pinning ensures data authenticity. Users can verify against any public node.

6. **Barretenberg Verifier**: The on-chain verifier must correctly validate UltraPlonk proofs. Aztec's production deployment provides confidence.

### 6.3 Security Checklist

- [ ] Noir circuit formal verification
- [ ] Trail of Bits audit (programs + circuits)
- [ ] Barretenberg Solana verifier audit
- [ ] Pyth integration security review
- [ ] Economic attack simulation
- [ ] Fuzzing campaign (100M+ iterations)
- [ ] Bug bounty program launch

---

## 7. Sequence Diagrams

### 7.1 Mint Flow

```
User                Frontend            Oracles (3+)        Solana Program
 │                     │                    │                    │
 ├─ Export r, tx_hash ─►                    │                    │
 │                     │                    │                    │
 │◄─── Fetch tx data ──┤                    │                    │
 │     from XMR node   │                    │                    │
 │                     │                    │                    │
 │                     ├─ Generate Poseidon │                    │
 │                     │   commitment       │                    │
 │                     │                    │                    │
 │                     ├─ Generate Noir ────►                    │
 │                     │   proof (2-3s)     │                    │
 │                     │                    │                    │
 │                     │                    ├── submit_vote ────►│
 │                     │                    │   (weight: 1.0)    │
 │                     │                    ├── submit_vote ────►│
 │                     │                    │   (weight: 1.22)   │
 │                     │                    ├── submit_vote ────►│
 │                     │                    │   (weight: 1.41)   │
 │                     │                    │                    │
 │                     │                    │◄── Consensus ──────┤
 │                     │                    │    (3.63 ≥ 3.0)    │
 │                     │                    │                    │
 │                     ├────── mint() ──────────────────────────►│
 │                     │   + proof          │                    │
 │                     │   + merkle proofs  │                    │
 │                     │                    │                    │
 │◄─────────────────── wXMR (SPL token) ────────────────────────┤
```

### 7.2 Liquidation Flow (Full Position Takeover)

```
Liquidator          Solana Program           Pyth Oracle
    │                    │                       │
    ├─── liquidate() ───►│                       │
    │    (lp_position)   │                       │
    │                    ├── get_price() ───────►│
    │                    │◄── price + conf ──────┤
    │                    │    + ema              │
    │                    │                       │
    │                    ├── Validate price      │
    │                    │   (age < 60s)         │
    │                    │   (conf < 2%)         │
    │                    │                       │
    │                    ├── Check ratio         │
    │                    │   (≤ 120%)            │
    │                    │                       │
    │                    ├── Transfer entire     │
    │                    │   position:           │
    │                    │   - All USD1 collat   │
    │                    │   - All wXMR debt     │
    │                    │                       │
    │◄── New position ───┤                       │
    │    owner           │                       │
    │                    │                       │
    │                    ├── Original LP         │
    │                    │   position closed     │
```

### 7.3 Block Root Submission

```
Oracle Node         Monero Network          Solana Program
    │                    │                       │
    ├── getblock() ─────►│                       │
    │◄── block data ─────┤                       │
    │                    │                       │
    ├── Extract outputs  │                       │
    │                    │                       │
    ├── Compute          │                       │
    │   txMerkleRoot     │                       │
    │   outputMerkleRoot │                       │
    │                    │                       │
    ├── submit_block_root() ───────────────────►│
    │                    │                       │
    │                    │   ┌── Verify oracle ──┤
    │                    │   │   is registered   │
    │                    │   │                   │
    │                    │   ├── Store roots ────┤
    │                    │   │                   │
    │◄── confirmation ───────┴──────────────────┤
```

---

## 8. Deployment

### 8.1 Pre-Mainnet Requirements

- [ ] Noir circuit formal verification (Ecne/similar)
- [ ] Trail of Bits audit (programs + circuits)
- [ ] Barretenberg verifier security review
- [ ] Monero wallet integration (`get_tx_key` support)
- [ ] Pyth XMR/USD feed production approval
- [ ] Guardian multisig setup (3-of-5)
- [ ] Initial oracle set deployment (5 nodes minimum)
- [ ] USD1 integration approval
- [ ] Bug bounty program ($100k+ pool)

### 8.2 Deployment Addresses

**Solana Devnet (Testnet):**

| Component | Address | Status |
|-----------|---------|--------|
| Bridge Program | TBD | 🔄 In Development |
| Noir Verifier | TBD | 🔄 In Development |
| wXMR Token Mint | TBD | 🔄 In Development |
| USD1 (Mock) | TBD | 🔄 In Development |
| Pyth Feed (Devnet) | `GVXRSBjFk6e6J3NbVPXohDJetcTjaeeuykUpbQF8UoMU` | ✅ Available |

**Solana Mainnet (Target):**

| Component | Address | Status |
|-----------|---------|--------|
| Bridge Program | TBD | ⏳ Post-Audit |
| Noir Verifier | TBD | ⏳ Post-Audit |
| wXMR Token Mint | TBD | ⏳ Post-Audit |
| USD1 | TBD | ⏳ Pending Integration |
| Pyth Feed (Mainnet) | TBD | ⏳ Pending Approval |

### 8.3 Migration from EVM

For teams migrating from the Arbitrum/Base version:

| Aspect | EVM (Arbitrum/Base) | Solana |
|--------|---------------------|--------|
| Proof System | PLONK/Groth16 (Circom) | UltraPlonk (Noir) |
| Collateral | DAI (sDAI, aDAI) | USD1 |
| Price Oracle | Chainlink TWAP | Pyth Network |
| Gas Model | ETH + L2 fees | SOL priority fees |
| Verification Cost | ~137k gas (~$1.45) | ~400k CU (~$0.04) |
| Settlement Time | ~12 seconds | ~400ms |
| Contract Language | Solidity | Rust (Anchor) |

---

## 9. Risk Parameters Summary

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Initial Collateral | 150% | Buffer against XMR volatility |
| Liquidation Threshold | ≤120% | Full position takeover trigger |
| Pyth Staleness | 60 seconds | Balance freshness vs availability |
| Pyth Confidence Max | 2% | Reject manipulated prices |
| Min Oracle Bond | 1,000 USD1 | Skin in the game |
| Min Weighted Votes | 3.0 | Decentralization + security |
| Guardian Unpause Delay | 30 days | Time for community response |
| Oracle Node Change Cooldown | 7 days | Prevent rapid Sybil attacks |
| Confirmation Requirement | 10 blocks | ~20 min Monero finality |

---

## 10. License & Disclaimer

**License:** MIT (Noir circuits), Apache 2.0 (Solana programs)

This is experimental cryptographic software. Security audits are required before mainnet deployment. The bridge handles real value and cryptographic verification—use at your own risk.

**No warranty is provided.** The authors and contributors are not liable for any loss of funds or other damages arising from the use of this software.

---

*Document Version: 7.1.0*
*Last Updated: January 2026*
*Authors: FUNGERBIL Team*

**v7.1 Changes from v7.0 (EVM):**
- Migrated from Circom to Noir (~617 constraints, down from ~1157)
- Replaced Chainlink TWAP with Pyth Network integration
- Changed collateral from DAI to USD1
- Ported from Solidity to Anchor/Rust
- Updated cost estimates for Solana compute units
- Added Solana-specific account structures and PDAs
- Integrated Barretenberg verifier for on-chain proof verification