/**
 * Monero->Solana Bridge - On-Chain Proof Verification
 * 
 * This script verifies a Noir ZK proof on Solana by sending a transaction
 * to the deployed verifier program.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Configuration
const DEVNET_RPC = 'https://api.devnet.solana.com';
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';

interface VerificationConfig {
  network: 'devnet' | 'mainnet';
  verifierProgramId: string;
  proofPath: string;
  publicWitnessPath: string;
  payerKeypairPath: string;
}

/**
 * Verify a Noir proof on Solana
 */
async function verifyProofOnChain(config: VerificationConfig): Promise<void> {
  console.log('🔍 Monero->Solana Bridge - Proof Verification');
  console.log('═'.repeat(60));
  
  // Connect to Solana
  const rpcUrl = config.network === 'devnet' ? DEVNET_RPC : MAINNET_RPC;
  const connection = new Connection(rpcUrl, 'confirmed');
  console.log(`📡 Connected to ${config.network}: ${rpcUrl}`);
  
  // Load payer keypair
  const payerKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(config.payerKeypairPath, 'utf-8')))
  );
  console.log(`💰 Payer: ${payerKeypair.publicKey.toBase58()}`);
  
  // Check balance
  const balance = await connection.getBalance(payerKeypair.publicKey);
  console.log(`💵 Balance: ${balance / 1e9} SOL`);
  
  if (balance === 0) {
    throw new Error('Insufficient balance. Fund your wallet first!');
  }
  
  // Load proof and public witness
  const proofBytes = readFileSync(config.proofPath);
  const publicWitnessBytes = readFileSync(config.publicWitnessPath);
  
  console.log(`📄 Proof size: ${proofBytes.length} bytes`);
  console.log(`📄 Public witness size: ${publicWitnessBytes.length} bytes`);
  
  // Construct instruction data: proof || public_witness
  const instructionData = Buffer.concat([proofBytes, publicWitnessBytes]);
  console.log(`📦 Total instruction data: ${instructionData.length} bytes`);
  
  // Create verification instruction
  const verifierProgramId = new PublicKey(config.verifierProgramId);
  const instruction = new TransactionInstruction({
    keys: [],
    programId: verifierProgramId,
    data: instructionData,
  });
  
  // Create and send transaction
  console.log('\n🚀 Sending verification transaction...');
  const transaction = new Transaction().add(instruction);
  
  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payerKeypair],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    );
    
    console.log('✅ Proof verified successfully!');
    console.log(`📝 Transaction signature: ${signature}`);
    console.log(`🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=${config.network}`);
    
    // Get transaction details
    const txDetails = await connection.getTransaction(signature, {
      commitment: 'confirmed',
    });
    
    if (txDetails?.meta?.computeUnitsConsumed) {
      console.log(`⚡ Compute units consumed: ${txDetails.meta.computeUnitsConsumed.toLocaleString()}`);
      console.log(`💰 Estimated cost: ~$${(txDetails.meta.computeUnitsConsumed / 1e6 * 0.0001).toFixed(4)}`);
    }
    
  } catch (error) {
    console.error('❌ Verification failed!');
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Main entry point
 */
async function main() {
  // Default configuration
  const config: VerificationConfig = {
    network: (process.env.NETWORK as 'devnet' | 'mainnet') || 'devnet',
    verifierProgramId: process.env.VERIFIER_PROGRAM_ID || '',
    proofPath: process.env.PROOF_PATH || join('..', 'target', 'noirSolana.proof'),
    publicWitnessPath: process.env.PUBLIC_WITNESS_PATH || join('..', 'target', 'noirSolana.pw'),
    payerKeypairPath: process.env.PAYER_KEYPAIR || join('..', 'keypair', 'deployer.json'),
  };
  
  // Validate configuration
  if (!config.verifierProgramId) {
    console.error('❌ Error: VERIFIER_PROGRAM_ID not set');
    console.error('Set it with: export VERIFIER_PROGRAM_ID=<your_program_id>');
    process.exit(1);
  }
  
  try {
    await verifyProofOnChain(config);
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { verifyProofOnChain, VerificationConfig };
