import * as moneroTs from 'monero-ts';

/**
 * Derive Monero view key from spend key
 * In Monero, view_key = H_s(spend_key) where H_s is the Keccak hash function
 */
export async function deriveViewKey(spendKey: string): Promise<string> {
  // Create a temporary wallet to derive keys
  const wallet = await moneroTs.createWalletKeys({
    networkType: moneroTs.MoneroNetworkType.STAGENET,
    privateSpendKey: spendKey,
  });

  const viewKey = await wallet.getPrivateViewKey();
  await wallet.close();

  return viewKey;
}

/**
 * Get address from spend key
 */
export async function getAddressFromSpendKey(spendKey: string, networkType: moneroTs.MoneroNetworkType = moneroTs.MoneroNetworkType.STAGENET): Promise<string> {
  const wallet = await moneroTs.createWalletKeys({
    networkType,
    privateSpendKey: spendKey,
  });

  const address = await wallet.getPrimaryAddress();
  await wallet.close();

  return address;
}
