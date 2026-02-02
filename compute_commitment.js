// Simple script to compute the Pedersen commitment for the Prover.toml values
// This helps us get the circuit to execute successfully

const values = [
    "12345678901234567890",      // tx_secret_key_r
    "1000000000000",              // amount_v as Field
    "98765432109876543210",       // stealth_secret_H_s
    "111111111111111111",         // one_time_address_R_x
    "333333333333333333",         // ecdh_encrypted_S_x
    "555555555555555555",         // stealth_address_P_x
    "123456789012345678"          // tx_hash
];

console.log("Computing Pedersen commitment for values:");
values.forEach((v, i) => console.log(`  [${i}]: ${v}`));

console.log("\nNote: The actual commitment computation requires the Barretenberg backend.");
console.log("For now, we'll use a placeholder value of 1 to demonstrate circuit execution.");
console.log("\nUpdate Prover.toml with: commitment = \"1\"");
