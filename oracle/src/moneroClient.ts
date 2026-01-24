import axios, { AxiosInstance } from 'axios';

export interface MoneroOutput {
  txHash: string;
  outputIndex: number;
  amount: string;
  stealthAddress: string;
  oneTimeAddress: string;
  ecdhInfo: {
    amount: string;
    mask: string;
  };
  blockHeight: number;
}

export interface MoneroTransaction {
  hash: string;
  blockHeight: number;
  timestamp: number;
  outputs: MoneroOutput[];
}

export interface MoneroBlock {
  height: number;
  hash: string;
  timestamp: number;
  txHashes: string[];
}

export class MoneroClient {
  private client: AxiosInstance;
  private rpcUrl: string;

  constructor(rpcUrl: string = 'http://node.monerodevs.org:38089') {
    this.rpcUrl = rpcUrl;
    this.client = axios.create({
      baseURL: rpcUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Make JSON-RPC call to Monero daemon
   */
  private async rpcCall(method: string, params: any = {}): Promise<any> {
    try {
      const response = await this.client.post('/json_rpc', {
        jsonrpc: '2.0',
        id: '0',
        method,
        params,
      });

      if (response.data.error) {
        throw new Error(`RPC Error: ${response.data.error.message}`);
      }

      return response.data.result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Monero RPC request failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get current blockchain height
   */
  async getHeight(): Promise<number> {
    const result = await this.rpcCall('get_block_count');
    return result.count - 1; // Convert count to height
  }

  /**
   * Get block by height
   */
  async getBlock(height: number): Promise<MoneroBlock> {
    const result = await this.rpcCall('get_block', { height });
    
    const blockHeader = result.block_header;
    const block = JSON.parse(result.json);

    return {
      height: blockHeader.height,
      hash: blockHeader.hash,
      timestamp: blockHeader.timestamp,
      txHashes: block.tx_hashes || [],
    };
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(txHash: string): Promise<MoneroTransaction> {
    const result = await this.rpcCall('get_transactions', {
      txs_hashes: [txHash],
      decode_as_json: true,
    });

    if (!result.txs || result.txs.length === 0) {
      throw new Error(`Transaction not found: ${txHash}`);
    }

    const tx = result.txs[0];
    const txJson = JSON.parse(tx.as_json);

    // Extract outputs
    const outputs: MoneroOutput[] = txJson.vout.map((vout: any, index: number) => ({
      txHash,
      outputIndex: index,
      amount: vout.amount?.toString() || '0',
      stealthAddress: vout.target?.key || '',
      oneTimeAddress: txJson.rct_signatures?.outPk?.[index] || '',
      ecdhInfo: {
        amount: txJson.rct_signatures?.ecdhInfo?.[index]?.amount || '0',
        mask: txJson.rct_signatures?.ecdhInfo?.[index]?.mask || '0',
      },
      blockHeight: tx.block_height,
    }));

    return {
      hash: txHash,
      blockHeight: tx.block_height,
      timestamp: tx.block_timestamp,
      outputs,
    };
  }

  /**
   * Get all transactions in a block
   */
  async getBlockTransactions(height: number): Promise<MoneroTransaction[]> {
    const block = await this.getBlock(height);
    
    if (block.txHashes.length === 0) {
      return [];
    }

    // Fetch all transactions in parallel
    const txPromises = block.txHashes.map(hash => this.getTransaction(hash));
    return Promise.all(txPromises);
  }

  /**
   * Get all outputs in a block (for Merkle tree)
   */
  async getBlockOutputs(height: number): Promise<MoneroOutput[]> {
    const transactions = await this.getBlockTransactions(height);
    return transactions.flatMap(tx => tx.outputs);
  }

  /**
   * Get output by transaction hash and index
   */
  async getOutput(txHash: string, outputIndex: number): Promise<MoneroOutput> {
    const tx = await this.getTransaction(txHash);
    
    if (outputIndex >= tx.outputs.length) {
      throw new Error(`Output index ${outputIndex} out of range for tx ${txHash}`);
    }

    return tx.outputs[outputIndex];
  }

  /**
   * Check if node is reachable
   */
  async ping(): Promise<boolean> {
    try {
      await this.getHeight();
      return true;
    } catch {
      return false;
    }
  }
}
