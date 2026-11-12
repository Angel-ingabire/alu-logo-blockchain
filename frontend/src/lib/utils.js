export function formatAddress(address) {
  if (!address) return "";

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function normalizeHash(hash) {
  if (!hash) {
    throw new Error("A hash is required.");
  }

  const raw = hash.trim();
  const lowered = raw.toLowerCase();
  const value = lowered.startsWith("0x") ? lowered.slice(2) : lowered;

  if (!/^[0-9a-f]+$/.test(value) || value.length !== 64) {
    throw new Error("The hash must be exactly 32 bytes long (64 hexadecimal characters).");
  }

  return `0x${value}`;
}

export async function computeFileHash(file) {
  if (!file) {
    throw new Error("Please select an image first.");
  }

  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `0x${hash}`;
}

export function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(Number(value) * 1000);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}
