import axios, { AxiosInstance } from 'axios';

/**
 * Client for monero-wallet-rpc
 * Requires running: monero-wallet-rpc --stagenet --daemon-address stagenet.melo.tools:38081 --rpc-bind-port 38083 --disable-rpc-login
 */
export class MoneroWalletRpc {
  private client: AxiosInstance;
  private rpcUrl: string;

  constructor(rpcUrl: string = 'http://localhost:38083') {
    this.rpcUrl = rpcUrl;
    this.client = axios.create({
      baseURL: rpcUrl + '/json_rpc',
      timeout: 300000, // 5 minutes for sync operations
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private async rpcCall(method: string, params: any = {}): Promise<any> {
    try {
      const response = await this.client.post('', {
        jsonrpc: '2.0',
        id: '0',
        method,
        params,
      });

      if (response.data.error) {
        throw new Error(`RPC Error: ${response.data.error.message}`);
      }

      return response.data.result;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Wallet RPC request failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Restore wallet from mnemonic seed
   */
  async restoreFromSeed(
    filename: string,
    seed: string,
    restoreHeight: number,
    password: string = '',
    seedOffset: string = ''
  ): Promise<void> {
    await this.rpcCall('restore_deterministic_wallet', {
      restore_height: restoreHeight,
      filename,
      seed,
      seed_offset: seedOffset,
      password,
      language: 'English',
    });
  }

  /**
   * Restore wallet from secret spend key
   * Uses restore_deterministic_wallet which derives view key automatically
   */
  async restoreFromSpendKey(
    filename: string,
    spendKey: string,
    restoreHeight: number,
    password: string = '',
    seedOffset: string = ''
  ): Promise<void> {
    // Use restore_deterministic_wallet with seed (spend key)
    await this.rpcCall('restore_deterministic_wallet', {
      restore_height: restoreHeight,
      filename,
      seed: spendKey,
      seed_offset: seedOffset,
      password,
      language: 'English',
    });
  }

  /**
   * Open existing wallet
   */
  async openWallet(filename: string, password: string = ''): Promise<void> {
    await this.rpcCall('open_wallet', {
      filename,
      password,
    });
  }

  /**
   * Close current wallet
   */
  async closeWallet(): Promise<void> {
    await this.rpcCall('close_wallet');
  }

  /**
   * Set daemon address
   */
  async setDaemon(address: string, trusted: boolean = true): Promise<void> {
    await this.rpcCall('set_daemon', {
      address,
      trusted,
    });
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<{ balance: string; unlockedBalance: string }> {
    const result = await this.rpcCall('get_balance');
    return {
      balance: result.balance.toString(),
      unlockedBalance: result.unlocked_balance.toString(),
    };
  }

  /**
   * Get primary address
   */
  async getAddress(): Promise<string> {
    const result = await this.rpcCall('get_address');
    return result.address;
  }

  /**
   * Refresh wallet (sync with blockchain)
   */
  async refresh(): Promise<{ blocksReceived: number }> {
    const result = await this.rpcCall('refresh');
    return {
      blocksReceived: result.blocks_fetched || 0,
    };
  }

  /**
   * Get incoming transfers
   */
  async getIncomingTransfers(): Promise<Array<{
    amount: string;
    txHash: string;
    subaddrIndex: number;
    keyImage: string;
  }>> {
    const result = await this.rpcCall('incoming_transfers', {
      transfer_type: 'all',
    });

    if (!result.transfers) {
      return [];
    }

    return result.transfers.map((t: any) => ({
      amount: t.amount.toString(),
      txHash: t.tx_hash,
      subaddrIndex: t.subaddr_index?.minor || 0,
      keyImage: t.key_image || '',
    }));
  }

  /**
   * Get transaction by hash
   */
  async getTransferByTxid(txHash: string): Promise<any> {
    const result = await this.rpcCall('get_transfer_by_txid', {
      txid: txHash,
    });
    return result.transfer;
  }

  /**
   * Get transaction secret key (tx_secret_key_r)
   * This is CRITICAL for ZK proof generation!
   */
  async getTxKey(txHash: string): Promise<string> {
    const result = await this.rpcCall('get_tx_key', {
      txid: txHash,
    });
    return result.tx_key;
  }

  /**
   * Get all transactions
   */
  async getTransfers(options: {
    in?: boolean;
    out?: boolean;
    pending?: boolean;
    failed?: boolean;
    pool?: boolean;
  } = {}): Promise<any[]> {
    const result = await this.rpcCall('get_transfers', {
      in: options.in !== false,
      out: options.out || false,
      pending: options.pending || false,
      failed: options.failed || false,
      pool: options.pool || false,
    });

    return result.in || [];
  }

  /**
   * Check if wallet RPC is reachable
   */
  async ping(): Promise<boolean> {
    try {
      // Try a simple RPC call that doesn't require a wallet
      const response = await this.client.post('', {
        jsonrpc: '2.0',
        id: '0',
        method: 'get_version',
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
