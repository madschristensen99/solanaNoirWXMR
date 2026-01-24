import { Connection } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import { MoneroClient } from './moneroClient';
import { MerkleTreeBuilder } from './merkleTree';
import { OracleClient } from './oracleClient';

dotenv.config();

const MONERO_RPC_URL = process.env.MONERO_RPC_URL || 'https://stagenet.xmr.ditatompel.com';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const ORACLE_KEYPAIR_PATH = process.env.ORACLE_KEYPAIR_PATH || '../keypair/oracle.json';
const ORACLE_PROGRAM_ID = process.env.ORACLE_PROGRAM_ID || '';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '60000');
const START_BLOCK_HEIGHT = parseInt(process.env.START_BLOCK_HEIGHT || '0');

class OracleService {
  private moneroClient: MoneroClient;
  private oracleClient: OracleClient;
  private merkleBuilder: MerkleTreeBuilder;
  private lastProcessedBlock: number;
  private isRunning: boolean = false;

  constructor() {
    this.moneroClient = new MoneroClient(MONERO_RPC_URL);
    
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    this.oracleClient = new OracleClient(
      connection,
      ORACLE_KEYPAIR_PATH,
      ORACLE_PROGRAM_ID
    );
    
    this.merkleBuilder = new MerkleTreeBuilder();
    this.lastProcessedBlock = START_BLOCK_HEIGHT;
  }

  /**
   * Initialize oracle (first-time setup)
   */
  async initialize(): Promise<void> {
    console.log('🔧 Initializing oracle...');
    
    try {
      await this.oracleClient.initialize();
      console.log('✅ Oracle initialized successfully');
    } catch (error: any) {
      if (error.message.includes('already initialized')) {
        console.log('ℹ️  Oracle already initialized');
      } else {
        throw error;
      }
    }
  }

  /**
   * Process a single block
   */
  async processBlock(height: number): Promise<void> {
    console.log(`\n📦 Processing block ${height}...`);

    try {
      // Fetch all outputs in the block
      const outputs = await this.moneroClient.getBlockOutputs(height);
      
      if (outputs.length === 0) {
        console.log(`   No outputs in block ${height}, skipping`);
        return;
      }

      console.log(`   Found ${outputs.length} outputs`);

      // Build Merkle tree
      const tree = this.merkleBuilder.buildFromOutputs(outputs);
      const root = tree.getRoot();

      console.log(`   Merkle root: ${root.toString('hex').substring(0, 16)}...`);

      // Post to Solana
      const block = await this.moneroClient.getBlock(height);
      await this.oracleClient.postMerkleRoot({
        blockHeight: height,
        rootHash: root,
        timestamp: block.timestamp,
        txCount: outputs.length,
      });

      this.lastProcessedBlock = height;
      
    } catch (error: any) {
      console.error(`❌ Error processing block ${height}:`, error.message);
      throw error;
    }
  }

  /**
   * Main polling loop
   */
  async start(): Promise<void> {
    console.log('🚀 Starting Monero→Solana Oracle Service');
    console.log(`   Monero RPC: ${MONERO_RPC_URL}`);
    console.log(`   Solana RPC: ${SOLANA_RPC_URL}`);
    console.log(`   Oracle Authority: ${this.oracleClient.getAuthority().toBase58()}`);
    console.log(`   Poll Interval: ${POLL_INTERVAL_MS}ms`);
    console.log('');

    // Check connections
    console.log('🔍 Checking connections...');
    const moneroReachable = await this.moneroClient.ping();
    if (!moneroReachable) {
      throw new Error('Cannot reach Monero node');
    }
    console.log('✅ Monero node reachable');

    // Get oracle state
    const oracleState = await this.oracleClient.getOracleState();
    if (oracleState) {
      console.log(`✅ Oracle state found`);
      console.log(`   Last updated block: ${oracleState.lastUpdatedBlock}`);
      console.log(`   Total roots posted: ${oracleState.totalRootsPosted}`);
      this.lastProcessedBlock = Math.max(this.lastProcessedBlock, oracleState.lastUpdatedBlock);
    } else {
      console.log('⚠️  Oracle not initialized. Run with --init flag first.');
      return;
    }

    this.isRunning = true;

    // Main loop
    while (this.isRunning) {
      try {
        const currentHeight = await this.moneroClient.getHeight();
        console.log(`\n📊 Current Monero height: ${currentHeight}`);
        console.log(`   Last processed: ${this.lastProcessedBlock}`);

        // Process any missing blocks
        for (let height = this.lastProcessedBlock + 1; height <= currentHeight; height++) {
          await this.processBlock(height);
        }

        if (this.lastProcessedBlock >= currentHeight) {
          console.log('✅ All blocks processed, waiting for new blocks...');
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        
      } catch (error: any) {
        console.error('❌ Error in main loop:', error.message);
        console.log('⏳ Retrying in 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }

  /**
   * Stop the service
   */
  stop(): void {
    console.log('\n🛑 Stopping oracle service...');
    this.isRunning = false;
  }
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  const shouldInit = args.includes('--init');

  const service = new OracleService();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    service.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    service.stop();
    process.exit(0);
  });

  try {
    if (shouldInit) {
      await service.initialize();
    } else {
      await service.start();
    }
  } catch (error: any) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

main();
