// Shared encryption utilities for OAuth tokens
// Uses AES-256-GCM encryption with a key from Supabase secrets

const ENCRYPTION_KEY = Deno.env.get("EMAIL_ENCRYPTION_KEY") || "";

// Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Convert Uint8Array to hex string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

// Get or generate encryption key
async function getEncryptionKey(): Promise<CryptoKey> {
  if (!ENCRYPTION_KEY) {
    throw new Error("EMAIL_ENCRYPTION_KEY not set in Supabase secrets");
  }

  const keyBytes = hexToBytes(ENCRYPTION_KEY);
  return await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns: iv:ciphertext (both hex encoded)
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    data,
  );

  // Return iv:ciphertext
  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(ciphertext))}`;
}

/**
 * Decrypt a string encrypted with encrypt()
 * Input format: iv:ciphertext (both hex encoded)
 */
export async function decrypt(encrypted: string): Promise<string> {
  const key = await getEncryptionKey();
  const [ivHex, ciphertextHex] = encrypted.split(":");

  if (!ivHex || !ciphertextHex) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = hexToBytes(ivHex);
  const ciphertext = hexToBytes(ciphertextHex);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext),
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Generate a new 256-bit encryption key (for setup)
 * Run once and store in Supabase secrets
 */
export function generateEncryptionKey(): string {
  const key = crypto.getRandomValues(new Uint8Array(32));
  return bytesToHex(key);
}
