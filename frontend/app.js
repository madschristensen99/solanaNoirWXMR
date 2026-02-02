// ============================================
// STATE MANAGEMENT
// ============================================
const state = {
    connected: false,
    walletAddress: null,
    xmrBalance: 0,
    zxmrBalance: 0,
    tvl: 0,
    totalMinted: 0,
    xmrPrice: 0,
    transactions: []
};

// ============================================
// CONSTANTS
// ============================================
const VERIFIER_PROGRAM = 'Cn1NByVWjX3691JnSg8PTbzRJBT9mSWv8J3eSD2ZurXy';
const BRIDGE_PROGRAM = 'G6V8QRJi7H8APsuhGSmNaX8qLMRd4oW63y9UjCyRpEtr';
const MINT_FEE = 0.003; // 0.3%
const BURN_FEE = 0.003; // 0.3%

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    updateUI();
});

function initializeApp() {
    // Simulate connection
    setTimeout(() => {
        state.connected = true;
        updateNetworkStatus();
        loadMockData();
    }, 1000);
}

function loadMockData() {
    // Mock data for demonstration
    state.xmrBalance = 0.073;
    state.zxmrBalance = 0.045;
    state.tvl = 125000;
    state.totalMinted = 850.5;
    state.xmrPrice = 147.32;
    
    state.transactions = [
        {
            type: 'mint',
            amount: 0.05,
            hash: '5caae835...c1439a',
            timestamp: Date.now() - 3600000
        },
        {
            type: 'burn',
            amount: 0.025,
            hash: 'efab0257...af2682',
            timestamp: Date.now() - 7200000
        }
    ];
    
    updateUI();
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Input handlers
    document.getElementById('xmrAmount').addEventListener('input', calculateMintAmount);
    document.getElementById('zxmrBurnAmount').addEventListener('input', calculateBurnAmount);

    // Button handlers
    document.getElementById('mintBtn').addEventListener('click', handleMint);
    document.getElementById('burnBtn').addEventListener('click', handleBurn);
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

// ============================================
// CALCULATIONS
// ============================================
function calculateMintAmount() {
    const xmrAmount = parseFloat(document.getElementById('xmrAmount').value) || 0;
    const fee = xmrAmount * MINT_FEE;
    const zxmrReceive = xmrAmount - fee;
    
    document.getElementById('zxmrReceive').value = zxmrReceive.toFixed(6);
}

function calculateBurnAmount() {
    const zxmrAmount = parseFloat(document.getElementById('zxmrBurnAmount').value) || 0;
    const fee = zxmrAmount * BURN_FEE;
    const xmrReceive = zxmrAmount - fee;
    
    document.getElementById('xmrReceive').value = xmrReceive.toFixed(6);
}

// ============================================
// BRIDGE OPERATIONS
// ============================================
async function handleMint() {
    const amount = parseFloat(document.getElementById('xmrAmount').value);
    const txHash = document.getElementById('moneroTxHash').value;
    const outputIndex = parseInt(document.getElementById('outputIndex').value);

    if (!amount || !txHash) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    const btn = document.getElementById('mintBtn');
    setButtonLoading(btn, true);

    try {
        showToast('Generating zero-knowledge proof...', 'warning');
        await sleep(2000);

        showToast('Verifying proof on Solana...', 'warning');
        await sleep(2000);

        showToast('Minting zXMR tokens...', 'warning');
        await sleep(1500);

        // Simulate successful mint
        const mintAmount = amount - (amount * MINT_FEE);
        state.zxmrBalance += mintAmount;
        state.totalMinted += mintAmount;
        
        addTransaction('mint', mintAmount, txHash);
        
        showToast(`Successfully minted ${mintAmount.toFixed(6)} zXMR!`, 'success');
        
        // Reset form
        document.getElementById('xmrAmount').value = '';
        document.getElementById('zxmrReceive').value = '';
        document.getElementById('moneroTxHash').value = '';
        
        updateUI();
    } catch (error) {
        showToast('Mint failed: ' + error.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function handleBurn() {
    const amount = parseFloat(document.getElementById('zxmrBurnAmount').value);
    const xmrAddress = document.getElementById('moneroAddress').value;

    if (!amount || !xmrAddress) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    if (amount > state.zxmrBalance) {
        showToast('Insufficient zXMR balance', 'error');
        return;
    }

    const btn = document.getElementById('burnBtn');
    setButtonLoading(btn, true);

    try {
        showToast('Locking zXMR tokens...', 'warning');
        await sleep(1500);

        showToast('Creating burn request...', 'warning');
        await sleep(1500);

        showToast('Waiting for LP to send XMR...', 'warning');
        await sleep(2000);

        // Simulate successful burn
        const burnAmount = amount - (amount * BURN_FEE);
        state.zxmrBalance -= amount;
        state.totalMinted -= amount;
        
        addTransaction('burn', amount, 'pending');
        
        showToast(`Burn request created! You will receive ${burnAmount.toFixed(6)} XMR`, 'success');
        
        // Reset form
        document.getElementById('zxmrBurnAmount').value = '';
        document.getElementById('xmrReceive').value = '';
        document.getElementById('moneroAddress').value = '';
        
        updateUI();
    } catch (error) {
        showToast('Burn failed: ' + error.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

// ============================================
// UI UPDATES
// ============================================
function updateUI() {
    // Update balances
    document.getElementById('xmrBalance').textContent = state.xmrBalance.toFixed(6);
    document.getElementById('zxmrBalance').textContent = state.zxmrBalance.toFixed(6);

    // Update stats
    document.getElementById('tvl').textContent = `$${state.tvl.toLocaleString()}`;
    document.getElementById('totalMinted').textContent = `${state.totalMinted.toFixed(2)} zXMR`;
    document.getElementById('xmrPrice').textContent = `$${state.xmrPrice.toFixed(2)}`;

    // Update transactions
    updateTransactionsList();
}

function updateNetworkStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('networkStatus');
    
    if (state.connected) {
        statusDot.style.background = 'var(--success)';
        statusText.textContent = 'Solana Devnet';
    } else {
        statusDot.style.background = 'var(--error)';
        statusText.textContent = 'Disconnected';
    }
}

function updateTransactionsList() {
    const list = document.getElementById('transactionsList');
    
    if (state.transactions.length === 0) {
        list.innerHTML = '<div class="empty-state">No transactions yet</div>';
        return;
    }

    list.innerHTML = state.transactions.map(tx => `
        <div class="transaction-item">
            <div class="tx-info">
                <div class="tx-type">${tx.type === 'mint' ? '🪙 Mint' : '🔥 Burn'}</div>
                <div class="tx-hash">${tx.hash}</div>
            </div>
            <div class="tx-amount ${tx.type}">
                ${tx.type === 'mint' ? '+' : '-'}${tx.amount.toFixed(6)} ${tx.type === 'mint' ? 'zXMR' : 'zXMR'}
            </div>
        </div>
    `).join('');
}

function addTransaction(type, amount, hash) {
    state.transactions.unshift({
        type,
        amount,
        hash: hash.substring(0, 10) + '...' + hash.substring(hash.length - 6),
        timestamp: Date.now()
    });
    
    // Keep only last 10 transactions
    if (state.transactions.length > 10) {
        state.transactions = state.transactions.slice(0, 10);
    }
}

// ============================================
// UTILITIES
// ============================================
function setButtonLoading(button, loading) {
    const text = button.querySelector('.btn-text');
    const loader = button.querySelector('.btn-loader');
    
    if (loading) {
        text.style.display = 'none';
        loader.style.display = 'inline';
        button.disabled = true;
    } else {
        text.style.display = 'inline';
        loader.style.display = 'none';
        button.disabled = false;
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// EXPORT FOR DEBUGGING
// ============================================
window.bridgeState = state;
window.showToast = showToast;

console.log('🌉 zXMR Bridge initialized');
console.log('Verifier Program:', VERIFIER_PROGRAM);
console.log('Bridge Program:', BRIDGE_PROGRAM);
