import { Connection } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import { OracleClient } from '../oracleClient';
import { MoneroClient } from '../moneroClient';
import { MerkleTreeBuilder } from '../merkleTree';

dotenv.config();

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const ORACLE_KEYPAIR_PATH = process.env.ORACLE_KEYPAIR_PATH || '../keypair/oracle.json';
const ORACLE_PROGRAM_ID = process.env.ORACLE_PROGRAM_ID || '';
const MONERO_RPC_URL = process.env.MONERO_RPC_URL || 'https://stagenet.xmr.ditatompel.com';

async function queryMerkleRoot(blockHeight: number) {
  console.log(`\n🔍 Querying Merkle root for block ${blockHeight}...`);
  
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  const oracle = new OracleClient(connection, ORACLE_KEYPAIR_PATH, ORACLE_PROGRAM_ID);

  const root = await oracle.getMerkleRoot(blockHeight);
  
  if (!root) {
    console.log(`❌ No Merkle root found for block ${blockHeight}`);
    return;
  }

  console.log(`\n✅ Merkle Root Found:`);
  console.log(`   Block Height: ${root.blockHeight}`);
  console.log(`   Root Hash: ${root.rootHash.toString('hex')}`);
  console.log(`   Timestamp: ${new Date(root.timestamp * 1000).toISOString()}`);
  console.log(`   TX Count: ${root.txCount}`);
}

async function showOracleState() {
  console.log(`\n🔍 Querying oracle state...`);
  
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  const oracle = new OracleClient(connection, ORACLE_KEYPAIR_PATH, ORACLE_PROGRAM_ID);

  const state = await oracle.getOracleState();
  
  if (!state) {
    console.log(`❌ Oracle not initialized`);
    return;
  }

  console.log(`\n✅ Oracle State:`);
  console.log(`   Authority: ${state.authority.toBase58()}`);
  console.log(`   Last Updated Block: ${state.lastUpdatedBlock}`);
  console.log(`   Total Roots Posted: ${state.totalRootsPosted}`);
}

// Parse CLI arguments
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.length === 0) {
    console.log(`
Monero→Solana Oracle Query Tool

Usage:
  npm run query -- --block <height>     Query Merkle root for block
  npm run query -- --state              Show oracle state

Examples:
  npm run query -- --block 1948001
  npm run query -- --state
    `);
    return;
  }

  try {
    if (args[0] === '--block') {
      const blockHeight = parseInt(args[1]);
      await queryMerkleRoot(blockHeight);
    } else if (args[0] === '--state') {
      await showOracleState();
    } else {
      console.log('Unknown command. Use --help for usage information.');
    }
  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    process.exit(1);
  }
}

main();
