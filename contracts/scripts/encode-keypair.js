// Base58 alphabet
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58encode(buf) {
  if (buf.length === 0) return '';

  let carry = 0;
  let digits = [0];

  for (let i = 0; i < buf.length; i++) {
    carry = buf[i];
    for (let j = 0; j < digits.length; ++j) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  let result = '';
  for (let i = buf.length - 1; i >= 0 && buf[i] === 0; i--) {
    result = '1' + result;
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += ALPHABET[digits[i]];
  }

  return result;
}

const secret = [227,230,202,124,9,153,99,97,251,244,31,119,83,230,41,140,174,107,102,187,127,17,137,175,106,249,147,208,3,100,218,178,142,228,161,142,91,40,33,36,118,10,235,44,94,0,212,247,78,124,213,148,182,74,58,119,89,119,134,150,8,102,161,53];
const encoded = base58encode(Buffer.from(secret));
console.log(encoded);
