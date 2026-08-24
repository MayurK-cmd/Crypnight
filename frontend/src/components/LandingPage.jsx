import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HowItWorks from './HowItWorks';
import GameModes from './GameModes';
import API from '../api/axios';
import { Loader2, Trophy } from 'lucide-react';

const formatWalletShort = (addr) => {
  if (!addr) return null;
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
};

const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [rows, setRows] = useState(null); // null = loading, [] = loaded-empty
  const [myRank, setMyRank] = useState(null); // null = loading/unauth, undefined = 404
  const navigate = useNavigate();

  // PHASE 6 §B — pull the real top-5 from /leaderboard/global on mount.
  // Best-effort: any failure just leaves the empty state in place.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const { data } = await API.get('/leaderboard/global?limit=5');
        if (!cancelled) setRows(data.leaderboard || []);
      } catch {
        if (!cancelled) setRows([]);
      }

      try {
        const { data } = await API.get('/leaderboard/my-rank');
        if (!cancelled) setMyRank(data ?? null);
      } catch (err) {
        if (!cancelled) setMyRank(undefined); // logged-out or unranked
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  // Smooth scroll helper for internal links
  const scrollToSection = (e, id) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-emerald-100 font-sans scroll-smooth">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="font-extrabold text-xl tracking-tighter">
              crypnight<span className="text-emerald-500">.XLM</span>
            </span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="hover:text-black transition-colors cursor-pointer">How it Works</a>
            <a href="#modes" onClick={(e) => scrollToSection(e, 'modes')} className="hover:text-black transition-colors cursor-pointer">Game Modes</a>
            <a href="#leaderboard" onClick={(e) => scrollToSection(e, 'leaderboard')} className="hover:text-black transition-colors cursor-pointer">Leaderboard</a>
            
            {/* Added Login and Signup Redirects */}
            <div className="flex items-center gap-4 ml-4">
              <button 
                onClick={() => navigate('/login')}
                className="text-slate-900 font-bold hover:text-emerald-600 transition-colors cursor-pointer"
              >
                Login
              </button>
              <button 
                onClick={() => navigate('/signup')}
                className="bg-black text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 cursor-pointer"
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden cursor-pointer" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16m-7 6h7"} />
            </svg>
          </button>
        </div>

        {/* Mobile Nav Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-100 p-6 flex flex-col gap-4">
            <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="text-lg font-medium cursor-pointer">How it Works</a>
            <a href="#modes" onClick={(e) => scrollToSection(e, 'modes')} className="text-lg font-medium cursor-pointer">Game Modes</a>
            <a href="#leaderboard" onClick={(e) => scrollToSection(e, 'leaderboard')} className="text-lg font-medium cursor-pointer">Leaderboard</a>
            <hr className="border-slate-100" />
            <button onClick={() => navigate('/login')} className="text-lg font-bold text-left cursor-pointer">Login</button>
            <button onClick={() => navigate('/signup')} className="w-full bg-black text-white py-3 rounded-xl font-bold text-center cursor-pointer">Sign Up</button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden text-center">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>
        <div className="max-w-7xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-bold mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            LIVE ON TESTNET
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8 leading-[1.1]">
            Checkmate to <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-emerald-700">Earn XLM.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-10 font-medium">
            The world's first decentralized chess puzzle arena. Compete in high-speed duels, Solve complex patterns, and get paid for your intelligence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/signup')}
              className="px-8 py-4 bg-black text-white rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-emerald-200 transition-all transform hover:-translate-y-1 cursor-pointer"
            >
              Get Started
            </button>
            <button
              onClick={(e) => scrollToSection(e, 'how-it-works')}
              className="px-8 py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all cursor-pointer"
            >
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Embedded Components */}
      <div id="how-it-works">
        <HowItWorks />
      </div>

      <div id="modes">
        <GameModes />
      </div>

      {/* Magic Block ER Section */}
      <section className="py-24 px-6 bg-gradient-to-b from-slate-50 to-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-bold mb-6">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            POWERED BY SOROBAN
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Instant Settlement on Stellar</h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-8 font-medium">
            CrypNight uses <span className="font-bold text-slate-700">Soroban smart contracts</span> for lightning-fast payouts. Your earnings settle instantly on-chain. No waiting for block confirmation delays—just skill, intelligence, and instant rewards.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200">
              <div className="text-2xl font-black text-emerald-600 mb-2">⚡</div>
              <h3 className="font-bold text-slate-900 mb-2">Instant Finality</h3>
              <p className="text-sm text-slate-500">Payouts confirmed instantly via Soroban smart contracts on Stellar</p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-slate-200">
              <div className="text-2xl font-black text-emerald-600 mb-2">💰</div>
              <h3 className="font-bold text-slate-900 mb-2">Settled & Final</h3>
              <p className="text-sm text-slate-500">Results finalized on Stellar ledger—100% final, zero rollback risk</p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-slate-200">
              <div className="text-2xl font-black text-emerald-600 mb-2">🎯</div>
              <h3 className="font-bold text-slate-900 mb-2">Better UX</h3>
              <p className="text-sm text-slate-500">See your balance update instantly after solving—no waiting, no guessing</p>
            </div>
          </div>
        </div>
      </section>

      {/* Leaderboard Section */}
      <section id="leaderboard" className="py-24 bg-white border-t border-slate-50">
        <div className="max-w-7xl mx-auto px-6">
           <div className="flex flex-col md:flex-row items-center justify-between mb-12">
             <div>
               <h2 className="text-4xl font-black tracking-tight italic">Top Strategists</h2>
               <p className="text-slate-500 mt-2 font-medium">The highest ELO performers this season.</p>
             </div>
             <button
               onClick={() => navigate('/leaderboard')}
               className="mt-4 md:mt-0 px-6 py-2 border border-slate-200 rounded-full text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer"
             >
               View Full Rankings
             </button>
           </div>

           <div className="bg-slate-50 rounded-[2.5rem] p-8 md:p-12 overflow-x-auto shadow-sm">
             {rows === null && (
               <div className="flex items-center justify-center py-12 gap-3 text-slate-400 font-bold">
                 <Loader2 className="animate-spin" size={20} />
                 Loading leaderboard…
               </div>
             )}

             {rows !== null && rows.length === 0 && (
               <div className="text-center py-12 text-slate-400 font-bold">
                 No ranked players yet — Solve 5 puzzles to land on the board.
               </div>
             )}

             {rows !== null && rows.length > 0 && (
               <table className="w-full text-left">
                 <thead>
                   <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-200">
                     <th className="pb-4 font-black">Rank</th>
                     <th className="pb-4 font-black">Player</th>
                     <th className="pb-4 font-black">ELO</th>
                     <th className="pb-4 font-black">Solved</th>
                     <th className="pb-4 font-black">Earned</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {rows.map((entry, i) => {
                     const display = entry.username || formatWalletShort(entry.wallet_address) || `Player ${entry.global_rank}`;
                     const medalColor =
                       i === 0 ? 'text-yellow-500' :
                       i === 1 ? 'text-slate-500' :
                       i === 2 ? 'text-amber-700' : 'text-slate-300';
                     return (
                       <tr key={entry.user_id} className="group hover:bg-white transition-colors">
                         <td className="py-6 font-mono text-sm">
                           <span className={`font-black ${medalColor}`}>
                             #{String(entry.global_rank ?? i + 1).padStart(2, '0')}
                           </span>
                         </td>
                         <td className="py-6">
                           <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-200 to-emerald-400 shadow-inner flex items-center justify-center text-emerald-900 font-black text-sm">
                               {display.slice(0, 2).toUpperCase()}
                             </div>
                             <div>
                               <p className="font-bold font-mono">{display}</p>
                               {entry.tier && (
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                   {entry.tier}
                                 </p>
                               )}
                             </div>
                           </div>
                         </td>
                         <td className="py-6 font-mono font-black text-emerald-600">{entry.rating}</td>
                         <td className="py-6 text-slate-500 font-bold">{entry.puzzles_Solved}</td>
                         <td className="py-6 text-slate-500 font-bold">
                           {Number(entry.total_earned ?? 0).toFixed(3)} XLM
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             )}
           </div>

           {/* PHASE 6 §B — Your Rank footer row. */}
           {myRank && (
             <div className="mt-6 p-6 rounded-2xl bg-emerald-50 border border-emerald-100 flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                   <Trophy size={20} />
                 </div>
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Your Rank</p>
                   <p className="text-xl font-black text-slate-900">
                     #{myRank.global_rank ?? myRank.tier_rank ?? '—'}{' '}
                     <span className="text-slate-400 text-base font-mono">·</span>{' '}
                     <span className="font-mono">{myRank.username || 'you'}</span>{' '}
                     <span className="text-slate-400 text-base font-mono">·</span>{' '}
                     <span className="font-mono text-emerald-700">{myRank.rating} ELO</span>
                   </p>
                 </div>
               </div>
               <button
                 onClick={() => navigate('/leaderboard')}
                 className="px-6 py-2 bg-emerald-500 text-white rounded-full text-sm font-bold hover:bg-emerald-600 transition-colors cursor-pointer"
               >
                 See Full Board
               </button>
             </div>
           )}

           {myRank === undefined && (
             <div className="mt-6 p-6 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
               <p className="text-sm text-slate-500 font-medium">
                 Sign up and start Solving to land on the board.
               </p>
               <button
                 onClick={() => navigate('/signup')}
                 className="px-6 py-2 bg-black text-white rounded-full text-sm font-bold hover:bg-slate-800 transition-colors cursor-pointer"
               >
                 Create Account →
               </button>
             </div>
           )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-4xl mx-auto bg-slate-900 rounded-[3rem] p-12 md:p-24 text-white relative overflow-hidden shadow-2xl">
           <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight italic mb-6">Ready to play?</h2>
            <p className="text-slate-400 text-lg mb-10 max-w-lg mx-auto font-medium">
              Join the future of competitive chess. Create your account and start earning today.
            </p>
            <button
              onClick={() => navigate('/signup')}
              className="px-10 py-4 bg-emerald-400 text-black rounded-2xl font-black text-xl hover:bg-emerald-300 transition-all shadow-xl shadow-emerald-500/20 cursor-pointer"
            >
              Sign Up Now
            </button>
           </div>
           <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full"></div>
        </div>
      </section>

      <footer className="py-12 border-t border-slate-100 text-center bg-white">
        <div className="flex justify-center gap-8 mb-6 font-bold text-sm">
            <a href="#" className="text-slate-400 hover:text-black transition-colors cursor-pointer">Twitter</a>
            <a href="#" className="text-slate-400 hover:text-black transition-colors cursor-pointer">Discord</a>
            <a href="#" className="text-slate-400 hover:text-black transition-colors cursor-pointer">Docs</a>
        </div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic">© 2026 Crypnight.XLM — Built on Stellar</p>
      </footer>
    </div>
  );
};

export default LandingPage;

