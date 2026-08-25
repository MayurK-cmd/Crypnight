# CrypNight — Stellar Wallet Chess Game

A full-stack chess puzzle game built on Stellar blockchain with wallet authentication and Soroban smart contracts.

[Live Demo](https://crypnight.vercel.app/) · [GitHub](https://github.com/MayurK-cmd/Crypnight) · [Solo Contract](https://stellar.expert/explorer/testnet/contract/CBZ2QQ2RFBEZCU74X2YT3DPY3UYC4YKLUF3ZI4YJOOHC563GBHAB26XT) · [Duel Contract](https://stellar.expert/explorer/testnet/contract/CAXDXQIEZD5MJT352AIT5TZXMCRZTU5RYLUR7LRULGBDG4IVP7VZHI4P)

[![CI/CD](https://github.com/MayurK-cmd/Crypnight/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/MayurK-cmd/Crypnight/actions/workflows/ci-cd.yml)

## Features

- Wallet auth via Freighter sign-in
- Chess puzzles with adaptive rating bands
- XLM payouts on Stellar Testnet
- Solo and Duel modes via Soroban smart contracts
- Tiered ELO leaderboard (1000–2500)
- Non-custodial — keys never leave your wallet
- 12/12 passing contract and transaction tests
- CI/CD with Vercel pre-deploy checks

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind, `@stellar/freighter-api`, `stellar-sdk`
- **Backend:** Node.js, Express, Supabase (Postgres + Auth), `stellar-sdk`, Jest
- **Blockchain:** Stellar Testnet, Soroban (Rust)

## Setup

**Prerequisites:** Node.js 18+, npm, Freighter browser extension, Git.

### 1. Clone

```bash
git clone https://github.com/MayurK-cmd/Crypnight.git
cd crypnight
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev   # http://localhost:5000
```

### 3. Frontend

```bash
cd ../frontend
npm install
cp .env.example .env
npm run dev   # http://localhost:5173
```

### Backend `.env`

```env
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NODE_ENV=development

STELLAR_SOLO_TREASURY_PUBLIC_KEY=G...
STELLAR_SOLO_TREASURY_SECRET_KEY=S...
STELLAR_DUEL_TREASURY_PUBLIC_KEY=G...
STELLAR_DUEL_TREASURY_SECRET_KEY=S...

STELLAR_SOLO_CONTRACT_ID=CBZ2QQ2RFBEZCU74X2YT3DPY3UYC4YKLUF3ZI4YJOOHC563GBHAB26XT
STELLAR_DUEL_CONTRACT_ID=CAXDXQIEZD5MJT352AIT5TZXMCRZTU5RYLUR7LRULGBDG4IVP7VZHI4P
```

### Frontend `.env`

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_API_URL=http://localhost:5000/api
VITE_PUZZLES_PER_SESSION=1
```

### Tests

```bash
cd backend
npm test -- tests/contract.test.js
```

## Deployment

- **Backend:** Push to GitHub, deploy via Railway or Render, set env vars.
- **Frontend:** Auto-deploys to Vercel via GitHub Actions — [crypnight.vercel.app](https://crypnight.vercel.app/)

## Smart Contracts

| Mode | Contract ID | Explorer |
|------|-------------|---------|
| Solo | `CBZ2QQ2RFBEZCU74X2YT3DPY3UYC4YKLUF3ZI4YJOOHC563GBHAB26XT` | [View](https://stellar.expert/explorer/testnet/contract/CBZ2QQ2RFBEZCU74X2YT3DPY3UYC4YKLUF3ZI4YJOOHC563GBHAB26XT) |
| Duel | `CAXDXQIEZD5MJT352AIT5TZXMCRZTU5RYLUR7LRULGBDG4IVP7VZHI4P` | [View](https://stellar.expert/explorer/testnet/contract/CAXDXQIEZD5MJT352AIT5TZXMCRZTU5RYLUR7LRULGBDG4IVP7VZHI4P) |

## Transaction with Contract

Solo mode ->
[view](https://stellar.expert/explorer/testnet/tx/4e9192fb6a2850b487da277bb55f397714fa7e5bd11e29eb4e814edff65043c9)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/wallet/nonce` | Get signing nonce |
| POST | `/api/wallet/verify` | Verify signature, login |
| GET | `/api/user/profile` | Get profile (auth required) |
| POST | `/api/solo/session` | Start solo session (auth required) |
| POST | `/api/solo/solve` | Submit solution (auth required) |
| GET | `/api/leaderboard` | Public rankings |

## Architecture

- **Auth:** Freighter nonce → signature verify → httpOnly session cookie
- **Game:** Solo/Duel session → puzzle fetch → solve → Soroban verify → XLM payout
- **DB:** `auth.users`, `public.users`, `game_profiles`, `solo_sessions`, `duel_sessions`, `solo_attempts`

## Security

Non-custodial auth, nonce signature verification, httpOnly cookies, CORS, rate-limited auth endpoints, Helmet headers, Joi input validation, env var protection.