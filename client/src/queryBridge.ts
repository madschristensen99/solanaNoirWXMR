/**
 * Query the Bridge Program on Solana Devnet
 * Shows the current state and demonstrates the program is live
 */

import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.solana.com';
const BRIDGE_PROGRAM_ID = 'G6V8QRJi7H8APsuhGSmNaX8qLMRd4oW63y9UjCyRpEtr';

async function queryBridge() {
  console.log('🔍 Querying Monero→Solana Bridge on Devnet');
  console.log('═'.repeat(60));
  console.log('');

  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const programId = new PublicKey(BRIDGE_PROGRAM_ID);

  // Get program account info
  console.log('📋 Bridge Program Info:');
  console.log(`   Program ID: ${programId.toBase58()}`);
  
  const accountInfo = await connection.getAccountInfo(programId);
  if (accountInfo) {
    console.log(`   ✅ Program is deployed and active`);
    console.log(`   Data size: ${accountInfo.data.length.toLocaleString()} bytes`);
    console.log(`   Owner: ${accountInfo.owner.toBase58()}`);
    console.log(`   Executable: ${accountInfo.executable}`);
    console.log(`   Rent epoch: ${accountInfo.rentEpoch}`);
  } else {
    console.log('   ❌ Program not found');
    return;
  }

  console.log('');
  console.log('🔗 View on Explorer:');
  console.log(`   https://explorer.solana.com/address/${programId.toBase58()}?cluster=devnet`);
  
  console.log('');
  console.log('📊 Program Accounts:');
  
  // Get all accounts owned by the program
  const programAccounts = await connection.getProgramAccounts(programId);
  console.log(`   Found ${programAccounts.length} account(s) managed by the bridge`);
  
  if (programAccounts.length > 0) {
    console.log('');
    console.log('   Account Details:');
    for (let i = 0; i < Math.min(5, programAccounts.length); i++) {
      const account = programAccounts[i];
      console.log(`   ${i + 1}. ${account.pubkey.toBase58()}`);
      console.log(`      Data size: ${account.account.data.length} bytes`);
      console.log(`      Lamports: ${account.account.lamports / 1e9} SOL`);
    }
  }

  console.log('');
  console.log('✅ Bridge program is live and operational on Solana Devnet!');
  console.log('');
  console.log('💡 Next steps:');
  console.log('   1. Generate a ZK proof with proper backend (Barretenberg/Sunspot)');
  console.log('   2. Submit proof for verification');
  console.log('   3. Mint wXMR tokens on successful verification');
}

queryBridge().catch(console.error);
