# zXMR Bridge Frontend

Beautiful, modern web interface for the Monero→Solana bridge.

## 🎨 Features

- **Mint zXMR**: Convert XMR to zXMR on Solana with zero-knowledge proofs
- **Burn zXMR**: Convert zXMR back to XMR
- **Real-time Stats**: TVL, total minted, XMR price, collateral ratio
- **Transaction History**: Track your bridge operations
- **Responsive Design**: Works on desktop and mobile
- **Toast Notifications**: User-friendly feedback
- **Dark Theme**: Easy on the eyes

## 🚀 Quick Start

### Option 1: Simple HTTP Server (Python)

```bash
cd frontend
python3 -m http.server 8000
```

Then open http://localhost:8000

### Option 2: Node.js HTTP Server

```bash
cd frontend
npx http-server -p 8000
```

### Option 3: Live Server (VS Code)

1. Install "Live Server" extension
2. Right-click `index.html`
3. Select "Open with Live Server"

## 📁 Files

- `index.html` - Main HTML structure
- `styles.css` - Beautiful gradient design with animations
- `app.js` - Bridge logic and UI interactions

## 🎯 Usage

### Minting zXMR

1. Enter the amount of XMR you want to bridge
2. Paste your Monero transaction hash
3. Enter the output index (usually 0)
4. Click "Generate Proof & Mint"
5. Wait for proof generation and verification
6. Receive zXMR in your Solana wallet

### Burning zXMR

1. Enter the amount of zXMR to burn
2. Paste your Monero address
3. Click "Request Burn"
4. Wait for LP to send XMR (2-hour window)
5. Receive XMR in your Monero wallet

## 🔧 Configuration

Update program IDs in `app.js`:

```javascript
const VERIFIER_PROGRAM = 'Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy';
const BRIDGE_PROGRAM = 'G6V8QRJi7H8APsuhGSmNaX8qLMRd4oW63y9UjCyRpEtr';
```

## 🎨 Design System

### Colors

- **Primary**: `#9945FF` (Solana purple)
- **Secondary**: `#14F195` (Solana green)
- **Background**: `#0a0a0f` (Deep dark)
- **Surface**: `#1a1a24` (Card background)

### Typography

- Font: Inter (system fallback)
- Headings: 600-700 weight
- Body: 400-500 weight

## 📱 Responsive Breakpoints

- Desktop: > 768px
- Mobile: ≤ 768px

## ⚡ Performance

- No external dependencies
- Vanilla JavaScript
- CSS animations (GPU accelerated)
- Optimized for 60fps

## 🔐 Security Notes

⚠️ **This is a demo frontend**

For production:
- Add Solana wallet integration (Phantom, Solflare)
- Implement actual RPC calls to bridge program
- Add proper error handling
- Implement transaction signing
- Add input validation
- Use HTTPS only

## 🛠️ Development

### Adding Wallet Integration

```javascript
// Example: Phantom wallet
async function connectWallet() {
    if (window.solana && window.solana.isPhantom) {
        const response = await window.solana.connect();
        state.walletAddress = response.publicKey.toString();
        updateUI();
    }
}
```

### Adding Real Bridge Calls

```javascript
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';

const connection = new Connection('https://api.devnet.solana.com');
const program = new Program(IDL, BRIDGE_PROGRAM, provider);

// Mint zXMR
await program.methods
    .mintWxmr(amount, proof, publicInputs, merkleRoot, blockHeight)
    .accounts({...})
    .rpc();
```

## 📚 Resources

- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Anchor Framework](https://www.anchor-lang.com/)
- [Protocol Specification](../PROTOCOL.md)
- [Deployment Guide](../DEPLOYMENT.md)

## 🎭 Demo Mode

The current implementation runs in demo mode with:
- Simulated transactions
- Mock balances
- Fake proof generation
- No actual blockchain interaction

Perfect for:
- UI/UX testing
- Design review
- User flow validation
- Screenshots/demos

## 🚧 TODOs

- [ ] Integrate Phantom wallet
- [ ] Connect to Solana RPC
- [ ] Real proof generation
- [ ] Transaction signing
- [ ] Error boundaries
- [ ] Loading states
- [ ] Form validation
- [ ] Price oracle integration
- [ ] LP dashboard
- [ ] Admin panel

## 📄 License

MIT

---

**Built with ❤️ for the Monero→Solana Bridge**
