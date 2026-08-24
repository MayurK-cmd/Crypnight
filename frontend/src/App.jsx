import LandingPage from './components/LandingPage'
import WalletLogin from './components/auth/WalletLogin'
import WalletSignup from './components/auth/WalletSignup'
import Dashboard from './components/auth/Dashboard'
import Setup from './components/auth/Setup'
import Profile from './components/auth/Profile'
import Redirect from './components/auth/Redirect'
import Solo from './components/gameModes/Solo'
import Duel from './components/gameModes/Duel'
import MatchHistory from './components/MatchHistory.jsx'
import Leaderboard from './components/Leaderboard.jsx'

import { AuthProvider } from './context/AuthContext';
import FreighterProvider from './wallet/WalletProvider';
import './App.css'
import {Route, Routes, Router, BrowserRouter} from 'react-router-dom'

function App() {


  return (
    <div>

      <AuthProvider>
      <FreighterProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<WalletLogin />} />
        <Route path="/signup" element={<WalletSignup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/redirect" element={<Redirect />} />
        <Route path="/solo" element={<Solo />} />
        <Route path="/duel" element={<Duel />} />
        <Route path="/match-history" element={<MatchHistory />} />
        <Route path="/leaderboard" element={<Leaderboard />} />

      </Routes>
      </BrowserRouter>
      </FreighterProvider>
      </AuthProvider>
    </div>
  )
}

export default App

