import pkg from 'stellar-sdk';
const { Keypair, StrKey, hash } = pkg;

// Freighter (and most Stellar wallets) implement the SEP-53 "Stellar Signed
// Message" convention. The actual bytes the wallet signs are
//   SHA256( "Stellar Signed Message:\n" + <message> )
//
// Confirmed against Freighter's source:
//   extension/src/helpers/stellar.ts → encodeSep53Message()
//   const SIGN_MESSAGE_PREFIX = "Stellar Signed Message:\n";
//   const signPayload = hash(Buffer.concat([prefix, messageBytes]));
//   const sig = Keypair.sign(signPayload);
//
// NOTE: the prefix is singular "Stellar", not "Stellarly" — that one-letter
// difference made verification always fail.
const SIGN_MESSAGE_PREFIX = "Stellar Signed Message:\n";

const stripJsonArray = (raw) => {
  if (!raw) return raw;
  const trimmed = String(raw).trim();
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) return arr.join("");
    } catch (_) { /* fall through */ }
  }
  return trimmed;
};

export const verifySignature = (message, signature, publicKey) => {
  try {
    if (!StrKey.isValidEd25519PublicKey(publicKey)) {
      console.error("Invalid Stellar public key format");
      return false;
    }

    const keypair = Keypair.fromPublicKey(publicKey);
    const cleaned = stripJsonArray(signature);

    // Decode signature in whatever encoding the client sent.
    const looksLikeBase64 = /^[A-Za-z0-9+/]+=*$/.test(cleaned);
    const looksLikeHex = /^[0-9a-fA-F]+$/.test(cleaned);
    const enc = looksLikeBase64 ? "base64" : looksLikeHex ? "hex" : "utf8";
    const sigBuf = Buffer.from(cleaned, enc);

    if (sigBuf.length !== 64) {
      return false;
    }

    // SEP-53: wallet signed SHA256(prefix || message)
    const messageBytes = Buffer.from(message, "utf8");
    const prefixBytes = Buffer.from(SIGN_MESSAGE_PREFIX, "utf8");
    const signedPayload = hash(Buffer.concat([prefixBytes, messageBytes]));

    return keypair.verify(signedPayload, sigBuf);
  } catch (err) {
    console.error("Signature verification error:", err.message);
    return false;
  }
};
