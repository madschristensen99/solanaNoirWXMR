# Monero→Solana Oracle

A push oracle that fetches Monero transaction data from a stagenet node and posts Merkle roots on-chain to Solana for verification.

## Overview

The oracle ensures that ZK proofs are verifying against real Monero blockchain data by:
1. Fetching transaction data from Monero stagenet node
2. Computing Merkle roots of transaction outputs
3. Posting roots on-chain to Solana
4. Allowing verifiers to check proofs against on-chain roots

## Architecture

```
Monero Stagenet Node → Oracle Service → Solana Program
     (RPC)              (Merkle Tree)    (On-chain Root)
                             ↓
                        ZK Verifier
                    (Checks against root)
```

## Components

### 1. Monero RPC Client
- Connects to: `https://stagenet.xmr.ditatompel.com`
- Fetches transaction data, outputs, and block information
- Extracts: tx_hash, output_index, stealth_address, one_time_address, ecdh_info

### 2. Merkle Tree Builder
- Constructs Merkle tree from transaction outputs
- Computes root hash using Keccak256
- Generates inclusion proofs for individual outputs

### 3. Solana Program (On-chain)
- Stores Merkle roots indexed by block height
- Validates Merkle proofs during ZK verification
- Provides query interface for roots

### 4. Oracle Service
- Polls Monero node for new blocks
- Updates Solana with new Merkle roots
- Handles retries and error recovery

## Setup

```bash
cd oracle
npm install
```

## Usage

### Start Oracle Service

```bash
npm run start
```

### Query Merkle Root

```bash
npm run query -- --block 1948001
```

## Security

- Only authorized oracle can post roots
- Block height validation prevents duplicates
- Cryptographically secure Merkle proofs
