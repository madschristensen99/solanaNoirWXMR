import { createHash } from 'crypto';
import { MoneroOutput } from './moneroClient';

export interface MerkleProof {
  leaf: Buffer;
  root: Buffer;
  proof: Buffer[];
  indices: number[];
}

export class MerkleTree {
  private leaves: Buffer[];
  private layers: Buffer[][];

  constructor(leaves: Buffer[]) {
    if (leaves.length === 0) {
      throw new Error('Cannot create Merkle tree with no leaves');
    }

    this.leaves = leaves;
    this.layers = this.buildTree(leaves);
  }

  /**
   * Hash function (Keccak256)
   */
  private hash(data: Buffer): Buffer {
    return createHash('sha256').update(data).digest();
  }

  /**
   * Combine two hashes
   */
  private combineHash(left: Buffer, right: Buffer): Buffer {
    // Sort to make tree deterministic regardless of order
    const sorted = Buffer.compare(left, right) < 0 ? [left, right] : [right, left];
    return this.hash(Buffer.concat(sorted));
  }

  /**
   * Build Merkle tree layers
   */
  private buildTree(leaves: Buffer[]): Buffer[][] {
    const layers: Buffer[][] = [leaves];
    
    while (layers[layers.length - 1].length > 1) {
      const currentLayer = layers[layers.length - 1];
      const nextLayer: Buffer[] = [];

      for (let i = 0; i < currentLayer.length; i += 2) {
        if (i + 1 < currentLayer.length) {
          // Pair exists
          nextLayer.push(this.combineHash(currentLayer[i], currentLayer[i + 1]));
        } else {
          // Odd number of nodes, duplicate the last one
          nextLayer.push(this.combineHash(currentLayer[i], currentLayer[i]));
        }
      }

      layers.push(nextLayer);
    }

    return layers;
  }

  /**
   * Get Merkle root
   */
  getRoot(): Buffer {
    return this.layers[this.layers.length - 1][0];
  }

  /**
   * Get Merkle proof for a leaf at given index
   */
  getProof(index: number): MerkleProof {
    if (index < 0 || index >= this.leaves.length) {
      throw new Error(`Invalid leaf index: ${index}`);
    }

    const proof: Buffer[] = [];
    const indices: number[] = [];
    let currentIndex = index;

    // Traverse from leaf to root
    for (let i = 0; i < this.layers.length - 1; i++) {
      const layer = this.layers[i];
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

      if (siblingIndex < layer.length) {
        proof.push(layer[siblingIndex]);
        indices.push(isRightNode ? 0 : 1); // 0 = left, 1 = right
      }

      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      leaf: this.leaves[index],
      root: this.getRoot(),
      proof,
      indices,
    };
  }

  /**
   * Verify a Merkle proof
   */
  static verify(proof: MerkleProof): boolean {
    let hash = proof.leaf;

    for (let i = 0; i < proof.proof.length; i++) {
      const sibling = proof.proof[i];
      const isLeft = proof.indices[i] === 0;

      // Recreate hash
      const sorted = isLeft 
        ? [sibling, hash] 
        : [hash, sibling];
      
      if (Buffer.compare(sorted[0], sorted[1]) > 0) {
        sorted.reverse();
      }

      hash = createHash('sha256').update(Buffer.concat(sorted)).digest();
    }

    return hash.equals(proof.root);
  }

  /**
   * Get total number of leaves
   */
  getLeafCount(): number {
    return this.leaves.length;
  }
}

/**
 * Build Merkle tree from Monero outputs
 */
export class MerkleTreeBuilder {
  /**
   * Serialize output to buffer for hashing
   */
  private serializeOutput(output: MoneroOutput): Buffer {
    const data = JSON.stringify({
      txHash: output.txHash,
      outputIndex: output.outputIndex,
      stealthAddress: output.stealthAddress,
      oneTimeAddress: output.oneTimeAddress,
      ecdhAmount: output.ecdhInfo.amount,
    });
    return Buffer.from(data, 'utf8');
  }

  /**
   * Build Merkle tree from outputs
   */
  buildFromOutputs(outputs: MoneroOutput[]): MerkleTree {
    if (outputs.length === 0) {
      throw new Error('Cannot build Merkle tree from empty outputs');
    }

    const leaves = outputs.map(output => {
      const serialized = this.serializeOutput(output);
      return createHash('sha256').update(serialized).digest();
    });

    return new MerkleTree(leaves);
  }

  /**
   * Get proof for specific output
   */
  getProofForOutput(outputs: MoneroOutput[], targetOutput: MoneroOutput): MerkleProof {
    const tree = this.buildFromOutputs(outputs);
    
    // Find index of target output
    const index = outputs.findIndex(
      output => 
        output.txHash === targetOutput.txHash && 
        output.outputIndex === targetOutput.outputIndex
    );

    if (index === -1) {
      throw new Error('Output not found in list');
    }

    return tree.getProof(index);
  }
}
