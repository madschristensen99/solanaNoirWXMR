import * as moneroTs from 'monero-ts';

export interface WalletTransaction {
  hash: string;
  blockHeight: number;
  timestamp: number;
  outputs: Array<{
    index: number;
    amount: bigint;
    keyImage: string;
    stealthAddress: string;
    oneTimeAddress: string;
    ecdhInfo: {
      amount: string;
      mask: string;
    };
  }>;
}

export class MoneroWalletManager {
  private wallet: moneroTs.MoneroWalletFull | null = null;
  private daemonUrl: string;

  constructor(daemonUrl: string = 'https://stagenet.xmr.ditatompel.com') {
    this.daemonUrl = daemonUrl;
  }

  /**
   * Restore wallet from secret spend key
   */
  async restoreWallet(
    secretSpendKey: string,
    restoreHeight: number,
    password: string = ''
  ): Promise<void> {
    console.log('🔄 Restoring Monero wallet from secret spend key...');
    console.log(`   Daemon: ${this.daemonUrl}`);
    console.log(`   Restore height: ${restoreHeight}`);

    try {
      // Create wallet config
      const config = new moneroTs.MoneroWalletConfig()
        .setNetworkType(moneroTs.MoneroNetworkType.STAGENET)
        .setServer(this.daemonUrl)
        .setPrimaryAddress('')
        .setPrivateSpendKey(secretSpendKey)
        .setRestoreHeight(restoreHeight)
        .setPassword(password);

      // Create wallet instance
      this.wallet = await moneroTs.createWalletFull(config);

      console.log('✅ Wallet restored successfully');
      
      // Get wallet info
      const primaryAddress = await this.wallet.getPrimaryAddress();
      const balance = await this.wallet.getBalance();
      const unlockedBalance = await this.wallet.getUnlockedBalance();
      
      console.log(`   Primary address: ${primaryAddress}`);
      console.log(`   Balance: ${balance} piconeros`);
      console.log(`   Unlocked: ${unlockedBalance} piconeros`);

    } catch (error: any) {
      console.error('❌ Failed to restore wallet:', error.message);
      throw error;
    }
  }

  /**
   * Sync wallet with blockchain
   */
  async sync(): Promise<void> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    console.log('🔄 Syncing wallet with blockchain...');
    
    const listener = new class extends moneroTs.MoneroWalletListener {
      async onSyncProgress(height: number, startHeight: number, endHeight: number, percentDone: number, message: string): Promise<void> {
        if (percentDone % 10 === 0 || percentDone === 100) {
          console.log(`   Sync progress: ${percentDone.toFixed(1)}% (${height}/${endHeight})`);
        }
      }
    };

    await this.wallet.addListener(listener);
    await this.wallet.sync();
    await this.wallet.removeListener(listener);

    console.log('✅ Wallet synced');
  }

  /**
   * Get all incoming transactions
   */
  async getIncomingTransactions(): Promise<WalletTransaction[]> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    console.log('📥 Fetching incoming transactions...');

    const txs = await this.wallet.getTxs({
      isIncoming: true,
      isConfirmed: true,
    });

    console.log(`   Found ${txs.length} incoming transactions`);

    const walletTxs: WalletTransaction[] = [];

    for (const tx of txs) {
      const outputs = tx.getIncomingTransfers() || [];
      
      const walletOutputs = outputs.map((transfer, index) => ({
        index: transfer.getAccountIndex(),
        amount: transfer.getAmount(),
        keyImage: '', // Key image not directly available
        stealthAddress: transfer.getAddress() || '',
        oneTimeAddress: '', // Will be filled from blockchain data
        ecdhInfo: {
          amount: '0',
          mask: '0',
        },
      }));

      walletTxs.push({
        hash: tx.getHash(),
        blockHeight: tx.getHeight() || 0,
        timestamp: tx.getReceivedTimestamp() || 0,
        outputs: walletOutputs,
      });
    }

    return walletTxs;
  }

  /**
   * Get specific transaction by hash
   */
  async getTransaction(txHash: string): Promise<WalletTransaction | null> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    const txs = await this.wallet.getTxs();
    const filteredTxs = txs.filter(t => t.getHash() === txHash);

    if (filteredTxs.length === 0) {
      return null;
    }

    const tx = filteredTxs[0];
    const outputs = tx.getIncomingTransfers() || [];

    const walletOutputs = outputs.map((transfer, index) => ({
      index: transfer.getAccountIndex(),
      amount: transfer.getAmount(),
      keyImage: '',
      stealthAddress: transfer.getAddress() || '',
      oneTimeAddress: '',
      ecdhInfo: {
        amount: '0',
        mask: '0',
      },
    }));

    return {
      hash: tx.getHash(),
      blockHeight: tx.getHeight() || 0,
      timestamp: tx.getReceivedTimestamp() || 0,
      outputs: walletOutputs,
    };
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<{ balance: bigint; unlocked: bigint }> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    const balance = await this.wallet.getBalance();
    const unlockedBalance = await this.wallet.getUnlockedBalance();

    return {
      balance,
      unlocked: unlockedBalance,
    };
  }

  /**
   * Get primary address
   */
  async getPrimaryAddress(): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    return await this.wallet.getPrimaryAddress();
  }

  /**
   * Close wallet
   */
  async close(): Promise<void> {
    if (this.wallet) {
      await this.wallet.close();
      this.wallet = null;
      console.log('✅ Wallet closed');
    }
  }
}
