/**
 * Complete Demo: Noir Proof Generation & Solana Verification
 * 
 * This script demonstrates the full flow:
 * 1. Generate a Noir proof for a Monero transaction
 * 2. Submit the proof to Solana for verification
 * 3. Verify the proof on-chain using the deployed verifier program
 */

import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import * as path from 'path';

// ============================================
// CONFIGURATION
// ============================================
const SOLANA_RPC = 'https://api.devnet.solana.com';
const VERIFIER_PROGRAM_ID = new PublicKey('Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy');
const BRIDGE_PROGRAM_ID = new PublicKey('G6V8QRJi7H8APsuhGSmNaX8qLMRd4oW63y9UjCyRpEtr');

// ============================================
// STEP 1: GENERATE NOIR PROOF
// ============================================
async function generateNoirProof() {
    console.log('\n🔐 Step 1: Generating Noir ZK Proof...\n');

    // Example Monero transaction data (from test_transactions.json)
    const moneroTx = {
        tx_hash: '5caae835b751a5ab243b455ad05c489cb9a06d8444ab2e8d3a9d8ef905c1439a',
        output_index: 0,
        amount: 20000000000000, // 20 XMR in piconeros
        tx_secret_key_r: '4cbf8f2cfb622ee126f08df053e99b96aa2e8c1cfd575d2a651f3343b465800a',
    };

    console.log('📝 Transaction Details:');
    console.log(`   Hash: ${moneroTx.tx_hash}`);
    console.log(`   Amount: ${moneroTx.amount / 1e12} XMR`);
    console.log(`   Output Index: ${moneroTx.output_index}`);

    console.log('\n🔧 Running: nargo prove...');
    console.log('   (Using existing Prover.toml)');
    
    try {
        const output = execSync('cd /home/remsee/solanaNoirWXMR && nargo prove', { encoding: 'utf-8' });
        console.log(output);
    } catch (error: any) {
        console.error('❌ Proof generation failed:', error.message);
        throw error;
    }

    // Read the generated proof
    const proofPath = '/home/remsee/solanaNoirWXMR/proofs/noirSolana.proof';
    const proof = readFileSync(proofPath);
    
    console.log(`\n✅ Proof generated successfully!`);
    console.log(`   Size: ${proof.length} bytes`);
    console.log(`   Location: ${proofPath}`);

    return proof;
}

// ============================================
// STEP 2: VERIFY ON SOLANA
// ============================================
async function verifyOnSolana(proof: Buffer) {
    console.log('\n🌐 Step 2: Verifying Proof on Solana...\n');

    // Connect to Solana
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    console.log(`✅ Connected to Solana: ${SOLANA_RPC}`);

    // Load wallet
    const walletPath = process.env.HOME + '/.config/solana/id.json';
    const walletKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(readFileSync(walletPath, 'utf-8')))
    );
    console.log(`✅ Wallet loaded: ${walletKeypair.publicKey.toString()}`);

    // Check balance
    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log(`💰 Balance: ${balance / 1e9} SOL`);

    // Create verification instruction
    console.log('\n🔨 Creating verification transaction...');
    
    const instructionData = Buffer.concat([
        Buffer.from([0]), // Instruction discriminator
        proof
    ]);

    const verifyInstruction = new TransactionInstruction({
        keys: [
            { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: false },
        ],
        programId: VERIFIER_PROGRAM_ID,
        data: instructionData,
    });

    const transaction = new Transaction().add(verifyInstruction);

    console.log('📤 Sending verification transaction...');
    try {
        const signature = await connection.sendTransaction(
            transaction,
            [walletKeypair],
            { skipPreflight: false }
        );

        console.log(`\n✅ Transaction sent!`);
        console.log(`   Signature: ${signature}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

        // Wait for confirmation
        console.log('\n⏳ Waiting for confirmation...');
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');

        if (confirmation.value.err) {
            console.error('❌ Verification failed:', confirmation.value.err);
            return false;
        }

        console.log('\n🎉 PROOF VERIFIED ON-CHAIN! 🎉\n');
        return true;

    } catch (error: any) {
        console.error('❌ Transaction failed:', error.message);
        if (error.logs) {
            console.log('\n📋 Program Logs:');
            error.logs.forEach((log: string) => console.log('   ', log));
        }
        return false;
    }
}

// ============================================
// MAIN EXECUTION
// ============================================
async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  Noir ZK Proof Verification on Solana - Complete Demo     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    try {
        // Step 1: Generate proof
        const proof = await generateNoirProof();

        // Step 2: Verify on Solana
        const verified = await verifyOnSolana(proof);

        if (verified) {
            console.log('\n╔════════════════════════════════════════════════════════════╗');
            console.log('║                    ✅ SUCCESS!                             ║');
            console.log('║                                                            ║');
            console.log('║  1. ✅ Noir proof generated                                ║');
            console.log('║  2. ✅ Proof verified on Solana                            ║');
            console.log('║  3. ✅ Ready to mint zXMR                                  ║');
            console.log('╚════════════════════════════════════════════════════════════╝');
        } else {
            console.log('\n❌ Verification failed - check logs above');
        }

    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

export { generateNoirProof, verifyOnSolana };
