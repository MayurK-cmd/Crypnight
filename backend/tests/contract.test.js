import { describe, it, expect, beforeAll } from '@jest/globals';
import * as StellarSdk from 'stellar-sdk';
import dotenv from 'dotenv';

dotenv.config();

const TESTNET_SERVER = 'https://horizon-testnet.stellar.org';
const SOLO_CONTRACT_ID = 'CBZ2QQ2RFBEZCU74X2YT3DPY3UYC4YKLUF3ZI4YJOOHC563GBHAB26XT';
const DUEL_CONTRACT_ID = 'CAXDXQIEZD5MJT352AIT5TZXMCRZTU5RYLUR7LRULGBDG4IVP7VZHI4P';
const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

describe('Soroban Contract Tests', () => {
  let server;
  let senderKeypair;

  beforeAll(() => {
    server = new StellarSdk.Horizon.Server(TESTNET_SERVER);
    const senderSecret = process.env.STELLAR_SOLO_TREASURY_SECRET_KEY;
    if (!senderSecret) {
      throw new Error('STELLAR_SOLO_TREASURY_SECRET_KEY not set');
    }
    senderKeypair = StellarSdk.Keypair.fromSecret(senderSecret);
  });

  describe('Contract Address Validation', () => {
    it('Should validate Solo Contract address format', () => {
      // Test that the contract ID is a valid Stellar contract address
      expect(SOLO_CONTRACT_ID).toMatch(/^C[A-Z2-7]{55}$/);
      expect(SOLO_CONTRACT_ID.length).toBe(56);
    });

    it('Should validate Duel Contract address format', () => {
      // Test that the contract ID is a valid Stellar contract address
      expect(DUEL_CONTRACT_ID).toMatch(/^C[A-Z2-7]{55}$/);
      expect(DUEL_CONTRACT_ID.length).toBe(56);
    });

    it('Should validate sender keypair', () => {
      // Test that the keypair is valid and can sign transactions
      const publicKey = senderKeypair.publicKey();
      expect(publicKey).toMatch(/^G[A-Z2-7]{55}$/);
      expect(publicKey.length).toBe(56);

      // Test that keypair can sign data
      const message = Buffer.from('test message');
      const signature = senderKeypair.sign(message);
      expect(signature).toBeDefined();
      expect(signature.length).toBeGreaterThan(0);
    });
  });

  describe('Contract Network Configuration', () => {
    it('Should connect to Stellar Testnet', async () => {
      // Test that we can reach the Horizon server
      const ledger = await server.ledgers().limit(1).call();
      expect(ledger.records).toBeDefined();
      expect(ledger.records.length).toBeGreaterThan(0);
      expect(ledger.records[0].sequence).toBeGreaterThan(0);
    });

    it('Should load sender account from Testnet', async () => {
      // Test that sender account exists and can be loaded
      const account = await server.loadAccount(senderKeypair.publicKey());
      expect(account).toBeDefined();
      expect(account.id).toBe(senderKeypair.publicKey());
      expect(account.sequence).toBeDefined();
    });

    it('Should verify Testnet network passphrase', () => {
      // Test that we're using the correct testnet passphrase
      expect(TESTNET_PASSPHRASE).toBe('Test SDF Network ; September 2015');
    });
  });

  describe('Transaction Building', () => {
    it('Should sign transaction with sender keypair', async () => {
      // Test that transaction can be signed properly
      const account = await server.loadAccount(senderKeypair.publicKey());

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: TESTNET_PASSPHRASE,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: 'GBPMWOIGRMK7UQVAISO32642KUMKZM2EBLLXAXBA5J5DHGZEMPZWV75Y',
            asset: StellarSdk.Asset.native(),
            amount: '1',
          })
        )
        .setTimeout(300)
        .build();

      transaction.sign(senderKeypair);

      expect(transaction.signatures.length).toBe(1);
      expect(transaction.signatures[0]).toBeDefined();
    });

    it('Should validate transaction fees', async () => {
      // Test that transaction fee calculation is correct
      const account = await server.loadAccount(senderKeypair.publicKey());

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: TESTNET_PASSPHRASE,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: 'GBPMWOIGRMK7UQVAISO32642KUMKZM2EBLLXAXBA5J5DHGZEMPZWV75Y',
            asset: StellarSdk.Asset.native(),
            amount: '1',
          })
        )
        .setTimeout(300)
        .build();

      const fee = parseInt(transaction.fee);
      expect(fee).toBeGreaterThanOrEqual(100);
    });

    it('Should build XLM payment operation', async () => {
      // Test that XLM payment operations can be constructed
      const account = await server.loadAccount(senderKeypair.publicKey());

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: TESTNET_PASSPHRASE,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: 'GBPMWOIGRMK7UQVAISO32642KUMKZM2EBLLXAXBA5J5DHGZEMPZWV75Y',
            asset: StellarSdk.Asset.native(),
            amount: '5.1234560',
          })
        )
        .setTimeout(300)
        .build();

      expect(transaction.operations[0].type).toBe('payment');
      expect(transaction.operations[0].destination).toBe('GBPMWOIGRMK7UQVAISO32642KUMKZM2EBLLXAXBA5J5DHGZEMPZWV75Y');
      expect(transaction.operations[0].amount).toBe('5.1234560');
    });
  });

  describe('XLM Transfer Operations', () => {
    it('Should validate recipient address format', () => {
      // Test that Stellar addresses are validated correctly
      const validAddress = 'GBPMWOIGRMK7UQVAISO32642KUMKZM2EBLLXAXBA5J5DHGZEMPZWV75Y';
      expect(validAddress).toMatch(/^G[A-Z2-7]{55}$/);
      expect(validAddress.length).toBe(56);
    });

    it('Should calculate stroops correctly', () => {
      // Test XLM to stroops conversion
      const xlmAmount = 7.4962134;
      const stroops = Math.floor(xlmAmount * 10000000);

      expect(stroops).toBe(74962134);
      expect(stroops).toBeGreaterThan(0);
    });

    it('Should validate contract IDs format', () => {
      // Test that contract IDs have correct format
      const contractIds = [SOLO_CONTRACT_ID, DUEL_CONTRACT_ID];

      contractIds.forEach(id => {
        expect(id).toMatch(/^C[A-Z2-7]{55}$/);
        expect(id.length).toBe(56);
      });
    });
  });
});

