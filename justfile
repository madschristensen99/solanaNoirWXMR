# Monero->Solana Bridge - Build & Deployment Commands
# Requires: Nargo 1.0.0-beta.13, Sunspot, Solana CLI

# Default recipe - show all commands
default:
    @just --list

# ============================================================================
# CIRCUIT DEVELOPMENT
# ============================================================================

# Check circuit compilation
check:
    nargo check

# Run all tests
test:
    nargo test

# Compile circuit to JSON artifact
compile:
    nargo compile

# Execute circuit with Prover.toml inputs
execute:
    nargo execute

# Get circuit info (constraint count)
info:
    nargo info

# ============================================================================
# SUNSPOT INTEGRATION
# ============================================================================

# Compile circuit to Sunspot CCS format
sunspot-compile:
    @echo "Compiling circuit with Sunspot..."
    sunspot compile --circuit-name noirSolana

# Setup proving/verifying keys
sunspot-setup:
    @echo "Generating proving and verifying keys..."
    sunspot setup --circuit-name noirSolana

# Generate proof from Prover.toml
sunspot-prove:
    @echo "Generating proof..."
    sunspot prove --circuit-name noirSolana

# Deploy verifier to Solana devnet
sunspot-deploy-devnet:
    @echo "Deploying verifier to Solana devnet..."
    sunspot deploy \
        --circuit-name noirSolana \
        --rpc-url https://api.devnet.solana.com \
        --keypair keypair/deployer.json

# Deploy verifier to Solana mainnet
sunspot-deploy-mainnet:
    @echo "⚠️  WARNING: Deploying to MAINNET"
    @echo "Make sure you have audited the circuit and have sufficient SOL"
    @read -p "Continue? (y/N) " confirm && [ "$confirm" = "y" ]
    sunspot deploy \
        --circuit-name noirSolana \
        --rpc-url https://api.mainnet-beta.solana.com \
        --keypair keypair/deployer.json

# ============================================================================
# WALLET SETUP
# ============================================================================

# Create keypair directory
setup-keypair-dir:
    mkdir -p keypair

# Generate deployer keypair for devnet
generate-keypair: setup-keypair-dir
    @echo "Generating deployer keypair..."
    solana-keygen new --outfile keypair/deployer.json --no-bip39-passphrase -s
    @echo "Keypair address: $(solana address -k keypair/deployer.json)"

# Fund deployer wallet on devnet
fund-devnet:
    @echo "Requesting airdrop on devnet..."
    solana airdrop 2 $(solana address -k keypair/deployer.json) --url devnet
    @echo "Balance: $(solana balance $(solana address -k keypair/deployer.json) --url devnet)"

# Check wallet balance on devnet
balance-devnet:
    @echo "Devnet balance:"
    solana balance $(solana address -k keypair/deployer.json) --url devnet

# Check wallet balance on mainnet
balance-mainnet:
    @echo "Mainnet balance:"
    solana balance $(solana address -k keypair/deployer.json) --url mainnet-beta

# ============================================================================
# FULL PIPELINE
# ============================================================================

# Complete setup: compile, setup keys, generate proof
full-setup: compile sunspot-compile sunspot-setup sunspot-prove
    @echo "✅ Full setup complete!"
    @echo "Next steps:"
    @echo "  1. Fund your wallet: just fund-devnet"
    @echo "  2. Deploy verifier: just sunspot-deploy-devnet"

# Deploy and verify on devnet
deploy-devnet: sunspot-deploy-devnet
    @echo "✅ Verifier deployed to devnet!"
    @echo "Verifier address: $(cat target/verifier_address.txt)"

# ============================================================================
# TESTING & VERIFICATION
# ============================================================================

# Verify proof on-chain (requires deployed verifier)
verify-onchain:
    @echo "Verifying proof on Solana..."
    cd client && npm run verify

# Run integration tests
test-integration:
    @echo "Running integration tests..."
    cd client && npm test

# ============================================================================
# CLEANUP
# ============================================================================

# Clean build artifacts
clean:
    rm -rf target/
    rm -f *.ccs *.pk *.vk *.proof *.pw

# Clean everything including keypairs (DANGEROUS)
clean-all: clean
    @echo "⚠️  WARNING: This will delete your keypair!"
    @read -p "Continue? (y/N) " confirm && [ "$confirm" = "y" ]
    rm -rf keypair/

# ============================================================================
# DEVELOPMENT HELPERS
# ============================================================================

# Watch for changes and recompile
watch:
    @echo "Watching for changes..."
    watchexec -w src -e nr "just check"

# Format Noir code
format:
    nargo fmt

# Run linter
lint:
    nargo check --show-warnings

# Generate proof with custom Prover.toml
prove-with FILE:
    @echo "Generating proof with {{FILE}}..."
    cp {{FILE}} Prover.toml
    just sunspot-prove

# ============================================================================
# DOCUMENTATION
# ============================================================================

# Generate circuit documentation
docs:
    @echo "Circuit: Monero->Solana Bridge"
    @echo "Constraints: $(nargo info | grep 'ACIR Opcodes' | awk '{print $4}')"
    @echo "See README.md for full documentation"

# Show circuit statistics
stats:
    @echo "=== Circuit Statistics ==="
    nargo info
    @echo ""
    @echo "=== File Sizes ==="
    @ls -lh target/*.json 2>/dev/null || echo "No compiled artifacts"
    @ls -lh *.ccs *.pk *.vk 2>/dev/null || echo "No Sunspot artifacts"
