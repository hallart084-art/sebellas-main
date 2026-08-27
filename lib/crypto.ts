/**
 * Hashes a password string using SHA-256 via the Web Crypto API.
 * This is a one-way hash, suitable for storing passwords securely in localStorage.
 * @param password - The plain text password to hash.
 * @returns A hex-encoded SHA-256 hash string.
 */
export async function hashPassword(password: string): Promise<string> {
 const msgBuffer = new TextEncoder().encode(password);
 const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
 const hashArray = Array.from(new Uint8Array(hashBuffer));
 return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
