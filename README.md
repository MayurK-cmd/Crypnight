# Crypnight ♟️

Stellar-based chess puzzle platform with real-time competitive duels, stake-based rewards, and on-chain settlement via Stellar smart contracts.

## Features

- **Solo Mode**: Race against the clock to solve chess puzzles, earn streaks and rewards
- **Duel Mode**: Challenge opponents with stake-based matches, independent lives system (3 strikes), winner-take-all payouts
- **Stellar Integration**: On-chain puzzle verification and efficient settlement via Stellar smart contracts
- **Freighter Wallet**: Seamless wallet connection and XLM stake management
- **Real-time WebSocket**: Live opponent moves, instant puzzle progression, reliable game state sync

## Tech Stack

- **Frontend**: React 18 + Vite, TailwindCSS, react-chessboard
- **Backend**: Express.js + WebSocket (ws), Supabase PostgreSQL
- **Blockchain**: Stellar Testnet, Soroban smart contracts
- **Games**: chess.js for move validation, FEN notation for board state

## Quick Start

### Prerequisites
- Node.js 18+
- Freighter wallet browser extension
- Stellar Testnet RPC access

### Installation

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Backend runs on `http://localhost:5000`, frontend on `http://localhost:5173`.

## Stellar Integration

Crypnight uses **Soroban** smart contracts on the Stellar network for puzzle verification and reward settlement, enabling efficient and low-cost on-chain operations.

### How It Works

1. **Puzzle Submission**: Backend submits solo session puzzle results to the Soroban contract
2. **Verification**: Contract verifies the solution proof on-chain
3. **On-chain Settlement**: Backend invokes the `settle_solo` contract function
4. **Reward Distribution**: Contract verifies results and transfers earned XLM to user's account

### Key Benefits

- **Low Fees**: Stellar's minimal transaction fees make micro-rewards economically viable
- **Speed**: 3–5 second finality on Stellar means near-instant settlement
- **Security**: Soroban contract logic ensures integrity of all game outcomes
- **Flexibility**: Backend can adjust puzzle difficulty without contract redeployment

### Architecture Diagram

```
User Session → Backend → Soroban Contract
                             ↓
                    On-chain Verification
                             ↓
                     Result Confirmed
                             ↓
              settle_solo invoked → Rewards transferred
```

### Configuration

Set these environment variables in backend `.env`:

```env
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_TESTNET_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
STELLAR_SOLO_CONTRACT_ID=CBZ2QQ2RFBEZCU74X2YT3DPY3UYC4YKLUF3ZI4YJOOHC563GBHAB26XT
STELLAR_DUEL_CONTRACT_ID=CAXDXQIEZD5MJT352AIT5TZXMCRZTU5RYLUR7LRULGBDG4IVP7VZHI4P
STELLAR_SOLO_TREASURY_PUBLIC_KEY=GBI7HSC7LUWMMVDAKXK6YHLFZQY3QYOCTNYF4A6EPAHIRD3X5LOBM3HR
STELLAR_DUEL_TREASURY_PUBLIC_KEY=GBCZAA7DVP6J422O5GNGKBK66KWZNNGB5GL6AAHRXORCES4OU4TEIYR4
```

See [Backend README](./backend/README.md#stellar-integration) for detailed setup.

## Game Modes

### Solo Mode

Race against a 3-minute timer to solve as many puzzles as possible. Earn streak multipliers:

- 1 puzzle: 1x reward
- 2-3 puzzles: 1.25x multiplier
- 4+ puzzles: 1.5x multiplier

Rewards settled and distributed on-chain via Soroban.

### Duel Mode

Head-to-head matches with XLM stakes:

- **Tier Selection**: Beginner (5 XLM) → Intermediate (10 XLM) → Pro (25 XLM) → Grandmaster (50 XLM)
- **Lives System**: Each player has 3 independent lives; 3 wrong moves = elimination
- **Puzzle Progression**: Per-player independent puzzles; solving one loads your next puzzle only
- **Winner Determination**: Most puzzles solved in 3 minutes wins the pot (2x stake)
- **Draw**: Equal puzzle count triggers refund to both players
- **Board State**: Opponent's board blurs when eliminated; winner can continue solving

Full duel flow: tier selection → matchmaking → deposit confirmation → game start → puzzle solving → settlement.

## Smart Contracts

Deployed on **Stellar Testnet** (Protocol 27 via Soroban).

### Solo Contract

**Address**: `CBZ2QQ2RFBEZCU74X2YT3DPY3UYC4YKLUF3ZI4YJOOHC563GBHAB26XT`

**Explorer**: https://stellar.expert/explorer/testnet/contract/CBZ2QQ2RFBEZCU74X2YT3DPY3UYC4YKLUF3ZI4YJOOHC563GBHAB26XT

**Treasury Account**: `GBI7HSC7LUWMMVDAKXK6YHLFZQY3QYOCTNYF4A6EPAHIRD3X5LOBM3HR`

Handles puzzle result verification and reward distribution via Soroban. Tracks 3% platform fees.

### Duel Contract

**Address**: `CAXDXQIEZD5MJT352AIT5TZXMCRZTU5RYLUR7LRULGBDG4IVP7VZHI4P`

**Explorer**: https://stellar.expert/explorer/testnet/contract/CAXDXQIEZD5MJT352AIT5TZXMCRZTU5RYLUR7LRULGBDG4IVP7VZHI4P

**Treasury Account**: `GBCZAA7DVP6J422O5GNGKBK66KWZNNGB5GL6AAHRXORCES4OU4TEIYR4`

Manages duel escrows and settlement logic via Soroban. Tracks 20% platform fees.

## Project Structure

```
crypnight/
├── backend/              # Express.js + WebSocket server
│   ├── src/
│   │   ├── controllers/  # Duel settlement, user endpoints
│   │   ├── services/     # WebSocket handlers, matchmaking, Stellar settlement
│   │   ├── routes/       # API and WebSocket route definitions
│   │   ├── config/       # Stellar + Supabase setup
│   │   └── utils/        # Helpers (rewards calculator, validators)
│   └── package.json
├── frontend/             # React 18 + Vite
│   ├── src/
│   │   ├── components/   # Solo, Duel, Dashboard components
│   │   ├── hooks/        # useDuelSocket, useAuth
│   │   ├── context/      # AuthContext
│   │   ├── api/          # Axios client
│   │   └── App.jsx
│   └── package.json
├── contracts/            # Soroban smart contracts (Rust)
│   ├── solo-mode/        # Solo mode contract
│   ├── duel-mode/        # Duel mode contract
│   └── Cargo.toml
└── README.md             # This file
```

## Environment Configuration

See individual component READMEs for detailed env setup:

- [Backend .env](./backend/README.md#environment-configuration)
- [Frontend .env](./frontend/README.md#environment-configuration)
- [Contracts setup](./crypnight-contracts/README.md#building--deploying)

## Documentation

- [**Backend README**](./backend/README.md) — API reference, WebSocket protocol, services documentation
- [**Frontend README**](./frontend/README.md) — Components, hooks, game mechanics, UI testing guide
- [**Contracts README**](./crypnight-contracts/README.md) — Contract addresses, account structures, function reference, security
- [**Deployment Guide**](./DEPLOY.md) — Production deployment steps for Vercel, Railway, Cloudflare Workers

## Testing

### Manual Duel Flow

1. Open two browsers (or incognito + normal)
2. Both connect Freighter wallet
3. Both select same tier
4. Both confirm stakes → approve Freighter transaction
5. Both click "Start Duel"
6. Play moves on both sides; verify:
   - Opponent's moves auto-play on your board
   - Lives decrement on wrong moves
   - New puzzle loads only for the player who failed
   - Board blurs when one player reaches 0 lives
   - Settlement called when time expires or one player eliminated

### Draw Scenario

1. Both players solve same number of puzzles
2. Let timer expire
3. Verify both see "Draw" result
4. Verify stakes refunded to both wallets

### Elimination Test

1. One player makes 3 wrong moves
2. That player's board blurs with "Waiting for opponent to finish"
3. Other player continues playing
4. Verify correct player wins when timer expires

## Deployment

See [DEPLOY.md](./DEPLOY.md) for:

- Vercel frontend deployment
- Backend options (Cloudflare Workers, Railway, Fly.io)
- Environment setup for production
- Mainnet migration checklist

## Development

### Building Contracts

```bash
cd crypnight-contracts
stellar contract build
```

### Running Tests

```bash
cd crypnight-contracts
cargo test
```

### Dev Server

Backend and frontend run with hot reload:

```bash
npm run dev
```

## Security & Audits

- Escrow uses a dedicated Stellar account (deterministic from match_id, no direct withdrawals)
- Settlement requires authorized backend signer
- Player wallets sign all stake deposits
- Sequence number validation prevents replay attacks
- Soroban contract logic cryptographically enforces all game outcomes

For mainnet deployment, smart contracts require professional security audit.

## Contributing

Contributions welcome. Before submitting, ensure:

- Code passes linter and type checks
- Manual game flow tested in two browsers
- No console logs in production code (backend logs are fine)

## License

MIT

## Support

For issues or questions:

- Check [Backend README](./backend/README.md) for API troubleshooting
- Check [Frontend README](./frontend/README.md) for UI issues
- Check [Contracts README](./crypnight-contracts/README.md) for blockchain issues
- Review [DEPLOY.md](./DEPLOY.md) for deployment problems
