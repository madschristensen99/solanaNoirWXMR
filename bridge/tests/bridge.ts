import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Bridge } from "../target/types/bridge";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("Monero→Solana Bridge - Full Flow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Bridge as Program<Bridge>;
  
  const authority = provider.wallet as anchor.Wallet;
  const lp = Keypair.generate();
  const user = Keypair.generate();
  const oracle = Keypair.generate();

  let wxmrMint: PublicKey;
  let usd1Mint: PublicKey;
  let bridgeState: PublicKey;
  let vault: PublicKey;
  let lpPosition: PublicKey;
  let lpUsd1Account: PublicKey;
  let userWxmrAccount: PublicKey;
  let blockRoot: PublicKey;

  const PYTH_FEED = new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"); // XMR/USD devnet
  const BLOCK_HEIGHT = 1900000;

  before(async () => {
    console.log("\n🚀 Setting up test environment...\n");

    // Airdrop SOL
    const airdropPromises = [
      provider.connection.requestAirdrop(lp.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(user.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(oracle.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
    ];
    await Promise.all(airdropPromises);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Create mints
    wxmrMint = await createMint(
      provider.connection,
      authority.payer,
      bridgeState || authority.publicKey, // Will update authority after bridge init
      null,
      9
    );
    console.log(`✅ wXMR mint: ${wxmrMint.toString()}`);

    usd1Mint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6
    );
    console.log(`✅ USD1 mint: ${usd1Mint.toString()}`);

    // Derive PDAs
    [bridgeState] = PublicKey.findProgramAddressSync(
      [Buffer.from("bridge"), wxmrMint.toBuffer()],
      program.programId
    );

    [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), bridgeState.toBuffer()],
      program.programId
    );

    [lpPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp"), bridgeState.toBuffer(), lp.publicKey.toBuffer()],
      program.programId
    );

    [blockRoot] = PublicKey.findProgramAddressSync(
      [Buffer.from("block"), bridgeState.toBuffer(), new BN(BLOCK_HEIGHT).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    // Create token accounts
    lpUsd1Account = await createAccount(
      provider.connection,
      lp,
      usd1Mint,
      lp.publicKey
    );

    userWxmrAccount = await createAccount(
      provider.connection,
      user,
      wxmrMint,
      user.publicKey
    );

    // Mint USD1 to LP
    await mintTo(
      provider.connection,
      authority.payer,
      usd1Mint,
      lpUsd1Account,
      authority.publicKey,
      1_000_000 * 1e6
    );
    console.log(`✅ Minted 1,000,000 USD1 to LP\n`);
  });

  it("1. Initialize Bridge", async () => {
    console.log("\n📋 Step 1: Initialize Bridge");

    const vk = Buffer.from("mock_verification_key");

    const tx = await program.methods
      .initialize(Array.from(vk))
      .accounts({
        authority: authority.publicKey,
        bridgeState,
        wxmrMint,
        usd1Mint,
        vault,
        pythFeed: PYTH_FEED,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log(`✅ Bridge initialized`);
    console.log(`   TX: ${tx}`);
    console.log(`   Program: ${program.programId.toString()}`);
    console.log(`   Bridge State: ${bridgeState.toString()}\n`);

    const bridge = await program.account.bridgeState.fetch(bridgeState);
    assert.equal(bridge.totalMinted.toNumber(), 0);
    assert.equal(bridge.paused, false);
  });

  it("2. Register LP with Collateral", async () => {
    console.log("\n💰 Step 2: Register LP with 10,000 USD1 collateral");

    const collateral = new BN(10_000 * 1e6); // 10k USD1

    const tx = await program.methods
      .registerLp(collateral)
      .accounts({
        owner: lp.publicKey,
        lpPosition,
        bridgeState,
        ownerUsd1: lpUsd1Account,
        vault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([lp])
      .rpc();

    console.log(`✅ LP registered`);
    console.log(`   TX: ${tx}`);
    console.log(`   LP Position: ${lpPosition.toString()}\n`);

    const lpPos = await program.account.lpPosition.fetch(lpPosition);
    assert.equal(lpPos.collateralAmount.toNumber(), collateral.toNumber());
    assert.equal(lpPos.mintedAmount.toNumber(), 0);
  });

  it("3. Oracle Submits Merkle Root", async () => {
    console.log("\n🌳 Step 3: Oracle submits Merkle root for block", BLOCK_HEIGHT);

    const blockHash = Buffer.alloc(32, 1);
    const txMerkleRoot = Buffer.alloc(32, 2);
    const outputMerkleRoot = Buffer.alloc(32, 3);

    const tx = await program.methods
      .submitMerkleRoot(
        new BN(BLOCK_HEIGHT),
        Array.from(blockHash),
        Array.from(txMerkleRoot),
        Array.from(outputMerkleRoot)
      )
      .accounts({
        oracle: oracle.publicKey,
        bridgeState,
        blockRoot,
        systemProgram: SystemProgram.programId,
      })
      .signers([oracle])
      .rpc();

    console.log(`✅ Merkle root submitted`);
    console.log(`   TX: ${tx}`);
    console.log(`   Block Root PDA: ${blockRoot.toString()}\n`);

    const root = await program.account.blockRoot.fetch(blockRoot);
    assert.equal(root.blockHeight.toNumber(), BLOCK_HEIGHT);
  });

  it("4. Mint wXMR with Proof", async () => {
    console.log("\n🪙 Step 4: Mint 0.05 wXMR (5e7 atomic units)");

    const amount = new BN(5e7); // 0.05 XMR
    const proof = Buffer.from("mock_zk_proof");
    const publicInputs = Buffer.from("mock_public_inputs");
    const merkleRoot = Buffer.alloc(32, 3); // Same as submitted

    const tx = await program.methods
      .mintWxmr(
        amount,
        Array.from(proof),
        Array.from(publicInputs),
        Array.from(merkleRoot),
        new BN(BLOCK_HEIGHT)
      )
      .accounts({
        user: user.publicKey,
        bridgeState,
        lpPosition,
        blockRoot,
        wxmrMint,
        userWxmr: userWxmrAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    console.log(`✅ wXMR minted`);
    console.log(`   TX: ${tx}\n`);

    const userAccount = await getAccount(provider.connection, userWxmrAccount);
    console.log(`   User wXMR balance: ${userAccount.amount.toString()} (${Number(userAccount.amount) / 1e9} wXMR)\n`);
    
    assert.ok(Number(userAccount.amount) > 0);
  });

  it("5. Burn wXMR", async () => {
    console.log("\n🔥 Step 5: Burn wXMR to release collateral");

    const userAccount = await getAccount(provider.connection, userWxmrAccount);
    const burnAmount = new BN(userAccount.amount.toString());

    // Create LP USD1 account for receiving collateral
    const lpUsd1Receive = await createAccount(
      provider.connection,
      lp,
      usd1Mint,
      lp.publicKey
    );

    const tx = await program.methods
      .burnWxmr(burnAmount)
      .accounts({
        user: user.publicKey,
        bridgeState,
        lpPosition,
        wxmrMint,
        userWxmr: userWxmrAccount,
        vault,
        lpUsd1: lpUsd1Receive,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    console.log(`✅ wXMR burned`);
    console.log(`   TX: ${tx}\n`);

    const userAccountAfter = await getAccount(provider.connection, userWxmrAccount);
    console.log(`   User wXMR balance after burn: ${userAccountAfter.amount.toString()}\n`);
    
    assert.equal(Number(userAccountAfter.amount), 0);

    console.log("\n🎉 FULL BRIDGE FLOW COMPLETE!");
    console.log("✅ Initialize → Register LP → Submit Merkle → Mint → Burn\n");
  });
});
