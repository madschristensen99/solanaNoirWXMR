import { MoneroWalletRpc } from '../walletRpc';
import { MoneroClient } from '../moneroClient';
import { MerkleTreeBuilder } from '../merkleTree';
import * as fs from 'fs';
import * as path from 'path';

const MNEMONIC_SEED = 'virtual spying rebel coexist shrugged cucumber batch subtly keyboard asylum ritual absorb issued exhale gave cylinder usher fewest value trendy oilfield swept shelter snake snake';
const RESTORE_HEIGHT = 1895520;
const WALLET_NAME = `test_wallet_${Date.now()}`;
const WALLET_RPC_URL = 'http://localhost:38083';
const DAEMON_URL = 'http://node.monerodevs.org:38089';

async function main() {
  console.log('🧪 Full Monero→Solana Bridge Test');
  console.log('===================================\n');

  console.log('⚠️  Prerequisites:');
  console.log('   1. Start monero-wallet-rpc: cd oracle && ./scripts/start-wallet-rpc.sh');
  console.log('   2. Wait for it to be ready, then run this test\n');

  const walletRpc = new MoneroWalletRpc(WALLET_RPC_URL);
  const moneroClient = new MoneroClient(DAEMON_URL);

  try {
    // Step 1: Check wallet RPC connection
    console.log('🔍 Checking wallet RPC connection...');
    const isReachable = await walletRpc.ping();
    if (!isReachable) {
      throw new Error('Cannot reach wallet RPC. Did you start monero-wallet-rpc?');
    }
    console.log('✅ Wallet RPC is reachable\n');

    // Step 2: Restore/open wallet
    console.log('🔄 Restoring wallet from mnemonic seed...');
    try {
      await walletRpc.restoreFromSeed(WALLET_NAME, MNEMONIC_SEED, RESTORE_HEIGHT);
      console.log('✅ Wallet restored\n');
    } catch (error: any) {
      if (error.message.includes('already exists') || error.message.includes('Already exists')) {
        console.log('ℹ️  Wallet already exists, opening...\n');
        try {
          await walletRpc.openWallet(WALLET_NAME);
        } catch (openError: any) {
          if (openError.message.includes('file not found')) {
            console.log('ℹ️  Wallet files not found, creating new wallet...\n');
            // Wallet was deleted, try restore again
            await walletRpc.restoreFromSeed(WALLET_NAME, MNEMONIC_SEED, RESTORE_HEIGHT);
            console.log('✅ Wallet restored\n');
          } else {
            throw openError;
          }
        }
      } else {
        throw error;
      }
    }

    // Step 3: Set daemon (in case wallet was created with different daemon)
    console.log('🔗 Setting daemon connection...');
    await walletRpc.setDaemon(DAEMON_URL, true);
    console.log('✅ Daemon set\n');

    // Step 4: Get wallet info
    const address = await walletRpc.getAddress();
    console.log(`📍 Wallet Address: ${address}\n`);

    // Step 5: Refresh/sync wallet
    console.log('🔄 Syncing wallet with blockchain...');
    const syncResult = await walletRpc.refresh();
    console.log(`✅ Synced (${syncResult.blocksReceived} blocks received)\n`);

    // Step 6: Get balance
    const balance = await walletRpc.getBalance();
    console.log(`💰 Wallet Balance:`);
    console.log(`   Total: ${balance.balance} piconeros (${Number(balance.balance) / 1e12} XMR)`);
    console.log(`   Unlocked: ${balance.unlockedBalance} piconeros (${Number(balance.unlockedBalance) / 1e12} XMR)\n`);

    // Step 7: Get incoming transactions
    console.log('📥 Fetching incoming transactions...');
    const transfers = await walletRpc.getIncomingTransfers();
    console.log(`✅ Found ${transfers.length} incoming transfers\n`);

    if (transfers.length === 0) {
      console.log('⚠️  No transactions found. Send some stagenet XMR to this address first.');
      return;
    }

    console.log('✅✅✅ SUCCESS! Wallet synced and transactions found!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Send an OUTGOING transaction to get tx_secret_key');
    console.log('   2. Use: monero-wallet-cli to send XMR');
    console.log('   3. Then run this test again to extract tx secret key');
    console.log('\n🎉 Oracle infrastructure is working!');
    return;

    /* TODO: Enable this code once we have outgoing transactions
    // Step 8: Get transaction details for first transfer
    const firstTransfer = transfers[0];
    console.log(`🔍 Analyzing first transaction:`);
    console.log(`   TX Hash: ${firstTransfer.txHash}`);
    console.log(`   Amount: ${firstTransfer.amount} piconeros (${Number(firstTransfer.amount) / 1e12} XMR)\n`);

    // Step 9: Get transaction secret key (CRITICAL for ZK proof!)
    console.log('🔑 Fetching transaction secret key (tx_secret_key_r)...');
    try {
      const txSecretKey = await walletRpc.getTxKey(firstTransfer.txHash);
      console.log(`✅ TX Secret Key: ${txSecretKey}\n`);

      // Save for ZK proof generation
      const proofData = {
        txHash: firstTransfer.txHash,
        txSecretKey,
        amount: firstTransfer.amount,
        keyImage: firstTransfer.keyImage,
      };

      const outputPath = path.join(__dirname, '../../proof_data.json');
      fs.writeFileSync(outputPath, JSON.stringify(proofData, null, 2));
      console.log(`💾 Saved proof data to: ${outputPath}\n`);

    } catch (error: any) {
      console.log(`⚠️  Could not get TX secret key: ${error.message}`);
      console.log(`   This might be an incoming transaction (we need outgoing tx for secret key)\n`);
    }

    // Step 10: Fetch full transaction data from blockchain
    console.log('🌐 Fetching full transaction data from blockchain...');
    const tx = await moneroClient.getTransaction(firstTransfer.txHash);
    console.log(`✅ Transaction details:`);
    console.log(`   Block Height: ${tx.blockHeight}`);
    console.log(`   Outputs: ${tx.outputs.length}\n`);

    // Step 11: Build Merkle tree for the block
    console.log(`🌳 Building Merkle tree for block ${tx.blockHeight}...`);
    const blockOutputs = await moneroClient.getBlockOutputs(tx.blockHeight);
    console.log(`   Found ${blockOutputs.length} total outputs in block`);

    const builder = new MerkleTreeBuilder();
    const tree = builder.buildFromOutputs(blockOutputs);
    const root = tree.getRoot();

    console.log(`\n   ✅ Merkle Root: ${root.toString('hex')}`);
    console.log(`   Tree Depth: ${Math.ceil(Math.log2(blockOutputs.length))}`);

    // Step 12: Get Merkle proof for our output
    const ourOutput = blockOutputs.find(o => o.txHash === firstTransfer.txHash);
    if (ourOutput) {
      const proof = builder.getProofForOutput(blockOutputs, ourOutput);
      console.log(`\n   📜 Merkle Proof:`);
      console.log(`      Proof Length: ${proof.proof.length}`);
      console.log(`      Leaf: ${proof.leaf.toString('hex').substring(0, 32)}...`);

      // Verify proof
      const { MerkleTree } = await import('../merkleTree');
      const isValid = MerkleTree.verify(proof);
      console.log(`      Valid: ${isValid ? '✅ YES' : '❌ NO'}`);

      // Save Merkle data
      const merkleData = {
        blockHeight: tx.blockHeight,
        root: root.toString('hex'),
        proof: proof.proof.map(p => p.toString('hex')),
        indices: proof.indices,
      };

      const merklePath = path.join(__dirname, '../../merkle_data.json');
      fs.writeFileSync(merklePath, JSON.stringify(merkleData, null, 2));
      console.log(`\n💾 Saved Merkle data to: ${merklePath}`);
    }

    console.log('\n✅ Full test completed successfully!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Use proof_data.json to generate ZK proof with Noir');
    console.log('   2. Use merkle_data.json to verify against on-chain root');
    console.log('   3. Submit proof to Solana for verification');
    */

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
