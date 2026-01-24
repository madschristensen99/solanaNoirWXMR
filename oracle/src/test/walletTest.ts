import { MoneroWalletManager } from '../walletManager';
import { MoneroClient } from '../moneroClient';
import { MerkleTreeBuilder } from '../merkleTree';

const SECRET_SPEND_KEY = '157095e54b300e667ee335a65731ce4723dcd70dffcdc55ff7a5adbb0023aa05';
const RESTORE_HEIGHT = 1895520;

// Try multiple stagenet nodes
const DAEMON_URLS = [
  'http://stagenet.melo.tools:38081',
  'http://stagenet.community.rino.io:38081',
  'https://stagenet.xmr.ditatompel.com',
];

let DAEMON_URL = DAEMON_URLS[0];

async function main() {
  console.log('🧪 Monero Wallet Test - Stagenet');
  console.log('=================================\n');

  const walletManager = new MoneroWalletManager(DAEMON_URL);
  const moneroClient = new MoneroClient(DAEMON_URL);

  try {
    // Step 1: Restore wallet
    await walletManager.restoreWallet(SECRET_SPEND_KEY, RESTORE_HEIGHT);

    // Step 2: Sync wallet
    await walletManager.sync();

    // Step 3: Get balance
    const balance = await walletManager.getBalance();
    console.log(`\n💰 Wallet Balance:`);
    console.log(`   Total: ${balance.balance} piconeros (${Number(balance.balance) / 1e12} XMR)`);
    console.log(`   Unlocked: ${balance.unlocked} piconeros (${Number(balance.unlocked) / 1e12} XMR)`);

    // Step 4: Get incoming transactions
    console.log('\n📥 Fetching incoming transactions...');
    const transactions = await walletManager.getIncomingTransactions();
    
    console.log(`\n✅ Found ${transactions.length} incoming transactions:\n`);

    for (const tx of transactions.slice(0, 5)) { // Show first 5
      console.log(`   TX: ${tx.hash}`);
      console.log(`   Block: ${tx.blockHeight}`);
      console.log(`   Outputs: ${tx.outputs.length}`);
      console.log(`   Amount: ${tx.outputs.reduce((sum, o) => sum + o.amount, 0n)} piconeros`);
      console.log('');
    }

    // Step 5: Test Merkle tree generation for first transaction
    if (transactions.length > 0) {
      const firstTx = transactions[0];
      console.log(`\n🌳 Testing Merkle Tree for TX: ${firstTx.hash}`);
      
      // Fetch all outputs in the block from RPC
      console.log(`   Fetching all outputs in block ${firstTx.blockHeight}...`);
      const blockOutputs = await moneroClient.getBlockOutputs(firstTx.blockHeight);
      console.log(`   Found ${blockOutputs.length} total outputs in block`);

      // Build Merkle tree
      const builder = new MerkleTreeBuilder();
      const tree = builder.buildFromOutputs(blockOutputs);
      const root = tree.getRoot();

      console.log(`\n   ✅ Merkle Root: ${root.toString('hex')}`);
      console.log(`   Tree depth: ${Math.ceil(Math.log2(blockOutputs.length))}`);

      // Get proof for first output of our transaction
      const ourOutput = blockOutputs.find(o => o.txHash === firstTx.hash);
      if (ourOutput) {
        const proof = builder.getProofForOutput(blockOutputs, ourOutput);
        console.log(`\n   📜 Merkle Proof:`);
        console.log(`      Proof length: ${proof.proof.length}`);
        console.log(`      Leaf: ${proof.leaf.toString('hex').substring(0, 32)}...`);
        console.log(`      Root: ${proof.root.toString('hex').substring(0, 32)}...`);
        
        // Verify proof
        const { MerkleTree } = await import('../merkleTree');
        const isValid = MerkleTree.verify(proof);
        console.log(`      Valid: ${isValid ? '✅' : '❌'}`);
      }
    }

    // Step 6: Close wallet
    await walletManager.close();

    console.log('\n✅ Test completed successfully!');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
