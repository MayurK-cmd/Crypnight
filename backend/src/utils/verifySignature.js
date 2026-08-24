import StellarSdk from 'stellar-sdk';

export const verifySignature = (message, signature, publicKey) => {
  try {
    // Verify the public key is valid Stellar format
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(publicKey)) {
      console.error('Invalid Stellar public key format');
      return false;
    }

    // Create keypair from public key
    const keypair = StellarSdk.Keypair.fromPublicKey(publicKey);

    // Encode message
    const messageBuffer = Buffer.from(message, 'utf-8');

    // Signature should be base64 encoded (Stellar standard)
    const signatureBuffer = Buffer.from(signature, 'base64');

    // Verify using Stellar SDK
    return keypair.verify(messageBuffer, signatureBuffer);
  } catch (err) {
    console.error('Signature verification error:', err.message);
    return false;
  }
};