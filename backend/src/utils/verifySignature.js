import nacl from 'tweetnacl';
import bs58 from 'bs58';

export const verifySignature = (message, signature, publicKey) => {
    const messageUnit8 = new TextEncoder().encode(message);
    const signatureUnit8 = bs58.decode(signature);
    const publicKeyUnit8 = bs58.decode(publicKey);

    return nacl.sign.detached.verify(messageUnit8, signatureUnit8, publicKeyUnit8);
};