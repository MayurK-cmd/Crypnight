# CrypNight - Stellar Wallet Chess Game

A full-stack chess puzzle game built on Stellar blockchain with wallet-based authentication and Soroban smart contracts.

🎮 **[Live Demo](https://crypnight.vercel.app/)** | 📊 **[GitHub](https://github.com/MayurK-cmd/Crypnight)** | 🔗 **[Stellar Expert - Solo Contract](https://stellar.expert/explorer/testnet/contract/CBZ2QQ2RFBEZCU74X2YT3DPY3UYC4YKLUF3ZI4YJOOHC563GBHAB26XT)**

[![CI/CD Pipeline](https://github.com/MayurK-cmd/Crypnight/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/MayurK-cmd/Crypnight/actions/workflows/ci-cd.yml)

## ✨ Features

- 🎮 **Wallet-Based Authentication** - Connect via Freighter wallet, sign nonce to authenticate
- ♟️ **Chess Puzzles** - Solve daily chess puzzles with varying difficulty
- 💰 **Stellar Testnet Integration** - Send/receive XLM on Stellar Testnet
- 🤝 **Smart Contracts** - Soroban contracts for Solo and Duel game modes
- 📊 **Leaderboard** - Competitive ranking system based on puzzle ratings
- 🔐 **Non-Custodial** - Your keys, your crypto - we never hold your funds
- ✅ **12 Passing Tests** - Comprehensive contract and transaction testing
- 🔄 **CI/CD Pipeline** - Automated testing with GitHub Actions

## 🚀 Live Deployment

**Frontend:** https://crypnight.vercel.app/
- Test Route: https://crypnight.vercel.app/test
- Signup: https://crypnight.vercel.app/signup
- Login: https://crypnight.vercel.app/login

## 🛠 Tech Stack

**Frontend:**
- React 19 with Vite
- Tailwind CSS
- Freighter Wallet Integration (@stellar/freighter-api)
- Stellar SDK (stellar-sdk)

**Backend:**
- Node.js + Express
- Supabase (PostgreSQL + Auth)
- Stellar SDK
- Soroban Smart Contracts (Rust)
- Jest Testing Framework

**Blockchain:**
- Stellar Testnet
- Soroban Smart Contracts

## 📋 Setup Instructions

### Prerequisites

- Node.js 18+
- npm or yarn
- Freighter Browser Extension
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/MayurK-cmd/Crypnight.git
cd crypnight
```

2. **Setup Backend**
```bash
cd backend
npm install

# Create .env file with the following:
cp .env.example .env
# Edit .env with your Supabase credentials and Stellar keys
```

3. **Setup Frontend**
```bash
cd ../frontend
npm install

# Create .env file:
cp .env.example .env
# Edit .env with your Supabase URL and anon key
```

### Environment Variables

**Backend (.env):**
```
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NODE_ENV=development

# Stellar Keys (get from your Freighter wallet or create new keypairs)
STELLAR_SOLO_TREASURY_PUBLIC_KEY=your-public-key
STELLAR_SOLO_TREASURY_SECRET_KEY=your-secret-key
STELLAR_DUEL_TREASURY_PUBLIC_KEY=your-public-key
STELLAR_DUEL_TREASURY_SECRET_KEY=your-secret-key

# Soroban Contracts (deployed addresses)
STELLAR_SOLO_CONTRACT_ID=CBZ2QQ2RFBEZCU74X2YT3DPY3UYC4YKLUF3ZI4YJOOHC563GBHAB26XT
STELLAR_DUEL_CONTRACT_ID=CAXDXQIEZD5MJT352AIT5TZXMCRZTU5RYLUR7LRULGBDG4IVP7VZHI4P
```

**Frontend (.env):**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:5000/api
VITE_PUZZLES_PER_SESSION=10
```

### Running Locally

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Server runs on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# App runs on http://localhost:5173
```

### Running Tests

```bash
cd backend
npm test -- tests/contract.test.js
```

**Test Results:**
- ✅ Test Suites: 1 passed
- ✅ Tests: 12 passed, 0 failed
- ✅ Time: ~3 seconds

## 📦 Deployment

### Backend Deployment (Railway/Render)

1. Push to GitHub
2. Connect repository to Railway or Render
3. Set environment variables in deployment dashboard
4. Deploy

### Frontend Deployment (Vercel)

**Live:** https://crypnight.vercel.app/

1. Connect GitHub repo to Vercel
2. Set environment variables
3. Deploy

## 🔗 Smart Contracts

### Solo Mode Contract
- **Address:** `CBZ2QQ2RFBEZCU74X2YT3DPY3UYC4YKLUF3ZI4YJOOHC563GBHAB26XT`
- **Network:** Stellar Testnet
- **Purpose:** Manage solo puzzle sessions and rewards
- **View:** https://stellar.expert/explorer/testnet/contract/CBZ2QQ2RFBEZCU74X2YT3DPY3UYC4YKLUF3ZI4YJOOHC563GBHAB26XT

### Duel Mode Contract
- **Address:** `CAXDXQIEZD5MJT352AIT5TZXMCRZTU5RYLUR7LRULGBDG4IVP7VZHI4P`
- **Network:** Stellar Testnet
- **Purpose:** Manage competitive duel sessions and escrow
- **View:** https://stellar.expert/explorer/testnet/contract/CAXDXQIEZD5MJT352AIT5TZXMCRZTU5RYLUR7LRULGBDG4IVP7VZHI4P

## 💰 Transaction Verification

**Test XLM Transfer (verified on Stellar Expert):**
- **Transaction Hash:** `4dcd5bc19fc8a0ff282923db9039e7ee3ef8af0212067321ecd8a6edc053305b`
- **Amount:** 9.2294909 XLM
- **Sender:** GBI7HSC7LUWMMVDAKXK6YHLFZQY3QYOCTNYF4A6EPAHIRD3X5LOBM3HR (Solo Treasury)
- **Recipient:** GBPMWOIGRMK7UQVAISO32642KUMKZM2EBLLXAXBA5J35DHGZEMPZWV75Y
- **Ledger:** 4310222
- **Network:** Stellar Testnet
- **Explorer Link:** https://stellar.expert/explorer/testnet/tx/4dcd5bc19fc8a0ff282923db9039e7ee3ef8af0212067321ecd8a6edc053305b

## 🧪 Testing

### Contract Tests (12/12 Passing)

Run all tests:
```bash
cd backend
npm test -- tests/contract.test.js
```

**Test Suites:**
1. **Contract Address Validation** (3 tests)
   - ✅ Validate Solo Contract address format
   - ✅ Validate Duel Contract address format
   - ✅ Validate sender keypair

2. **Contract Network Configuration** (3 tests)
   - ✅ Connect to Stellar Testnet
   - ✅ Load sender account from Testnet
   - ✅ Verify Testnet network passphrase

3. **Transaction Building** (3 tests)
   - ✅ Sign transaction with sender keypair
   - ✅ Validate transaction fees
   - ✅ Build XLM payment operation

4. **XLM Transfer Operations** (3 tests)
   - ✅ Validate recipient address format
   - ✅ Calculate stroops correctly
   - ✅ Validate contract IDs format

### CI/CD Pipeline

GitHub Actions workflow automatically runs tests on every push and PR:
- Location: `.github/workflows/ci-cd.yml`
- Runs: Node 20.x and 22.x
- Tests backend, frontend, and contracts
- Build verification included
- Status: ![CI/CD Pipeline](https://github.com/MayurK-cmd/Crypnight/actions/workflows/ci-cd.yml/badge.svg)

## 🏗 Architecture

### Authentication Flow
1. User connects Freighter wallet
2. Backend generates nonce
3. User signs nonce with wallet
4. Backend verifies signature and creates auth user
5. User receives session token in httpOnly cookie
6. Authenticated requests include token via cookie

### Game Flow
1. User selects Solo or Duel mode
2. Backend initializes session and fetches puzzles
3. Frontend renders chess board with puzzle position
4. User solves puzzle and submits solution
5. Backend verifies solution on-chain via Soroban contract
6. XLM rewards transferred to user wallet

### Database Schema
- `auth.users` - Supabase auth users
- `public.users` - User profiles and ratings
- `public.game_profiles` - Wallet-specific game data
- `public.solo_sessions` - Solo game session history
- `public.duel_sessions` - Competitive duel sessions
- `public.solo_attempts` - Puzzle attempt records

## 📡 API Endpoints

### Authentication
- `POST /api/wallet/nonce` - Get nonce for signing
- `POST /api/wallet/verify` - Verify signature and authenticate
- `POST /api/wallet/logout` - Clear session

### User
- `GET /api/user/profile` - Get user profile (protected)
- `PUT /api/user/profile` - Update user profile (protected)

### Solo Mode
- `POST /api/solo/session` - Start solo session (protected)
- `POST /api/solo/solve` - Submit puzzle solution (protected)
- `GET /api/solo/history` - Get session history (protected)

### Duel Mode
- `POST /api/duel/queue` - Join duel queue (protected)
- `POST /api/duel/solve` - Submit duel puzzle (protected)
- `GET /api/duel/status` - Get duel status (protected)

### Leaderboard
- `GET /api/leaderboard` - Get global leaderboard (public)
- `GET /api/leaderboard/weekly` - Get weekly rankings (public)

## 🔒 Security

- ✅ Non-custodial wallet authentication
- ✅ Nonce-based signature verification
- ✅ HttpOnly secure cookies
- ✅ CORS protection
- ✅ Rate limiting on auth endpoints
- ✅ Helmet security headers
- ✅ Input validation on all endpoints
- ✅ Environment variable protection

## 📈 Roadmap

- [ ] Mobile app (React Native)
- [ ] Mainnet deployment
- [ ] Tournament system
- [ ] NFT badges for achievements
- [ ] Streaming integration for puzzle creators
- [ ] AI-powered puzzle generation
- [ ] Multi-language support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - see LICENSE file for details

## 📞 Support

- 📧 Email: support@crypnight.com
- 💬 Discord: [Discord Server Link]
- 🐦 Twitter: [@crypnight](https://twitter.com/crypnight)

## 🌐 Stellar Network

- **Testnet Horizon:** https://horizon-testnet.stellar.org
- **Testnet RPC:** https://soroban-testnet.stellar.org
- **Faucet:** https://laboratory.stellar.org/#friendbot

## 📊 Project Stats

- ✅ **Commits:** 10+
- ✅ **Tests:** 12 passing
- ✅ **Coverage:** Contract validation, network config, transaction building
- ✅ **Contracts:** 2 deployed (Solo & Duel)
- ✅ **Transactions:** Verified on Stellar Testnet
- 🚀 **Status:** Production ready

---

**Built with ❤️ for the Stellar Community**

**Rise in Challenge Submission**
- Live Demo: https://crypnight.vercel.app/
- GitHub: Public repository with 10+ commits
- Contract Addresses: Solo & Duel deployed
- Transaction Hash: Verified on Stellar Expert
- Tests: 12/12 passing
- CI/CD: GitHub Actions configured
