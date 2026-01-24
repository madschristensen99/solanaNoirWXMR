import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import * as fs from 'fs';

export interface MerkleRootData {
  blockHeight: number;
  rootHash: Buffer;
  timestamp: number;
  txCount: number;
}

export class OracleClient {
  private connection: Connection;
  private authority: Keypair;
  private programId: PublicKey;

  constructor(
    connection: Connection,
    authorityKeypairPath: string,
    programId: string
  ) {
    this.connection = connection;
    this.programId = new PublicKey(programId);
    
    // Load authority keypair
    const keypairData = JSON.parse(fs.readFileSync(authorityKeypairPath, 'utf8'));
    this.authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  }

  /**
   * Derive PDA for oracle state
   */
  private async getOracleStatePDA(): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('oracle_state')],
      this.programId
    );
  }

  /**
   * Derive PDA for Merkle root account
   */
  private async getMerkleRootPDA(blockHeight: number): Promise<[PublicKey, number]> {
    const blockHeightBuffer = Buffer.alloc(8);
    blockHeightBuffer.writeBigUInt64LE(BigInt(blockHeight));
    
    return PublicKey.findProgramAddressSync(
      [Buffer.from('merkle_root'), blockHeightBuffer],
      this.programId
    );
  }

  /**
   * Initialize oracle (one-time setup)
   */
  async initialize(): Promise<string> {
    const [oracleStatePDA] = await this.getOracleStatePDA();

    // Check if already initialized
    const accountInfo = await this.connection.getAccountInfo(oracleStatePDA);
    if (accountInfo) {
      throw new Error('Oracle already initialized');
    }

    // Create initialize instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: this.authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: oracleStatePDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from([0]), // Instruction discriminator for Initialize
    });

    const transaction = new Transaction().add(instruction);
    const signature = await this.connection.sendTransaction(transaction, [this.authority]);
    await this.connection.confirmTransaction(signature);

    console.log(`✅ Oracle initialized. State PDA: ${oracleStatePDA.toBase58()}`);
    return signature;
  }

  /**
   * Post Merkle root for a block
   */
  async postMerkleRoot(data: MerkleRootData): Promise<string> {
    const [oracleStatePDA] = await this.getOracleStatePDA();
    const [merkleRootPDA] = await this.getMerkleRootPDA(data.blockHeight);

    // Check if root already posted
    const accountInfo = await this.connection.getAccountInfo(merkleRootPDA);
    if (accountInfo) {
      console.log(`⚠️  Merkle root for block ${data.blockHeight} already posted`);
      return '';
    }

    // Serialize data
    const dataBuffer = Buffer.alloc(8 + 32 + 8 + 4);
    dataBuffer.writeBigUInt64LE(BigInt(data.blockHeight), 0);
    data.rootHash.copy(dataBuffer, 8);
    dataBuffer.writeBigInt64LE(BigInt(data.timestamp), 40);
    dataBuffer.writeUInt32LE(data.txCount, 48);

    // Create post instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: this.authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: oracleStatePDA, isSigner: false, isWritable: true },
        { pubkey: merkleRootPDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.concat([Buffer.from([1]), dataBuffer]), // 1 = PostMerkleRoot
    });

    const transaction = new Transaction().add(instruction);
    const signature = await this.connection.sendTransaction(transaction, [this.authority]);
    await this.connection.confirmTransaction(signature);

    console.log(`✅ Posted Merkle root for block ${data.blockHeight}`);
    console.log(`   Root: ${data.rootHash.toString('hex')}`);
    console.log(`   TX: ${signature}`);
    
    return signature;
  }

  /**
   * Query Merkle root for a block
   */
  async getMerkleRoot(blockHeight: number): Promise<MerkleRootData | null> {
    const [merkleRootPDA] = await this.getMerkleRootPDA(blockHeight);
    
    const accountInfo = await this.connection.getAccountInfo(merkleRootPDA);
    if (!accountInfo) {
      return null;
    }

    // Deserialize data (skip 8-byte discriminator)
    const data = accountInfo.data.slice(8);
    const blockHeightRead = Number(data.readBigUInt64LE(0));
    const rootHash = data.slice(8, 40);
    const timestamp = Number(data.readBigInt64LE(40));
    const txCount = data.readUInt32LE(48);

    return {
      blockHeight: blockHeightRead,
      rootHash,
      timestamp,
      txCount,
    };
  }

  /**
   * Get oracle state
   */
  async getOracleState(): Promise<{
    authority: PublicKey;
    lastUpdatedBlock: number;
    totalRootsPosted: number;
  } | null> {
    const [oracleStatePDA] = await this.getOracleStatePDA();
    
    const accountInfo = await this.connection.getAccountInfo(oracleStatePDA);
    if (!accountInfo) {
      return null;
    }

    // Deserialize (skip 8-byte discriminator)
    const data = accountInfo.data.slice(8);
    const authority = new PublicKey(data.slice(0, 32));
    const lastUpdatedBlock = Number(data.readBigUInt64LE(32));
    const totalRootsPosted = Number(data.readBigUInt64LE(40));

    return {
      authority,
      lastUpdatedBlock,
      totalRootsPosted,
    };
  }

  /**
   * Get authority public key
   */
  getAuthority(): PublicKey {
    return this.authority.publicKey;
  }
}
