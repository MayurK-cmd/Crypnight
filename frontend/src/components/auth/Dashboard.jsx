import { useContext, useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import API from "../../api/axios";
import { LayoutDashboard, User, LogOut, Trophy, Swords, Zap, Menu, X, Gamepad2 } from 'lucide-react';

const CHESS_QUOTES = [
  "Chess is life. — Bobby Fischer",
  "Chess is mental torture. — Garry Kasparov",
  "Chess is the gymnasium of the mind. — Blaise Pascal",
  "Chess holds its master in its own bonds, shackling the mind and brain. — Albert Einstein",
  "The pawns are the soul of chess. — François-André Danican Philidor",
  "You must take your opponent into a deep, dark forest where 2+2 is 5, and the path leading out is only wide enough for one. — Mikhail Tal",
  "When you see a good move—wait—look for a better one. — Emanuel Lasker",
  "The blunders are all there on the board, waiting to be made. — Savielly Tartakower",
];

export default function Dashboard() {
  const { logout, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [rating, setRating] = useState("---");
  const [randomQuote, setRandomQuote] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await API.get("/user/profile");
        setRating(res.data.profile.rating);
      } catch (err) {
        console.error("Failed to load rating");
      }
    };
    fetchStats();
    setRandomQuote(CHESS_QUOTES[Math.floor(Math.random() * CHESS_QUOTES.length)]);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Profile', path: '/profile', icon: <User size={20} /> },
    { name: 'History', path: '/match-history', icon: <Trophy size={20} /> },
    { name: 'Rankings', path: '/leaderboard', icon: <Swords size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col md:flex-row">
      {/* Sidebar - Hidden on Mobile */}
      <aside className="hidden md:flex w-64 border-r border-slate-100 flex-col p-6 fixed h-full bg-white z-10">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <span className="font-extrabold text-xl tracking-tighter italic text-slate-900">crypnight<span className='text-emerald-500'>.sol</span></span>
        </div>

        <nav className="flex-1 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all cursor-pointer ${
                location.pathname === link.path
                ? 'bg-emerald-50 text-emerald-600'
                : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {link.icon} {link.name}
            </Link>
          ))}
        </nav>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl font-bold transition-all mt-auto cursor-pointer"
        >
          <LogOut size={20} /> Logout
        </button>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-extrabold text-lg tracking-tighter italic">crypnight.sol</span>
        </div>
        <button onClick={handleLogout} className="p-2 text-red-500 cursor-pointer">
          <LogOut size={20} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 p-6 md:p-10 relative pb-24 md:pb-10">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-12 gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight italic">
              Welcome back{user?.username ? `, ` : ', '}
              <span className="font-mono text-emerald-600">{user?.username || 'Strategist'}</span>.
            </h2>
            <p className="text-slate-500 mt-1 font-medium text-sm md:text-base">Ready to claim your next XLM reward?</p>
          </div>
          <a
            href="https://laboratory.stellar.org/#?network=test"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto bg-black text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200 cursor-pointer"
          >
            <Zap size={18} /> Stellar Testnet Faucet
          </a>
        </header>

        {/* Chess Quote Section */}
        <div className="mb-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-sm">
          <p className="text-lg md:text-xl italic text-slate-700 font-medium text-center">"{randomQuote}"</p>
        </div>

        {/* Bento Grid Stats/Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-slate-200 group">
             <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-2 uppercase tracking-tight">Solo Speed Arena</h3>
                <p className="text-slate-400 mb-8 text-sm max-w-xs leading-relaxed">Solve high-intensity puzzles to earn SOL based on your ELO tier.</p>
                <button
                  onClick={() => navigate('/solo')}
                  className="w-full md:w-auto bg-emerald-400 text-black px-8 py-4 rounded-2xl font-black hover:bg-emerald-300 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap size={18} fill="currentColor" /> ENTER SOLO MODE
                </button>
             </div>
             <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full group-hover:bg-emerald-500/20 transition-all duration-700"></div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 flex flex-col justify-between shadow-sm min-h-[200px]">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Current Rating</span>
              <p className="text-5xl font-black italic mt-2 text-emerald-600 tracking-tighter">{rating}</p>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-widest border-t border-slate-200 pt-4">Top 12% Globally</p>
          </div>

          <div className="md:col-span-2 bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-slate-200 group">
             <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-2 uppercase tracking-tight">Duel Arena</h3>
                <p className="text-slate-400 mb-8 text-sm max-w-xs leading-relaxed">Challenge opponents in real-time competitive puzzle duels with stake deposits.</p>
                <button
                  onClick={() => navigate('/duel')}
                  className="w-full md:w-auto bg-emerald-400 text-black px-8 py-4 rounded-2xl font-black hover:bg-emerald-300 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Gamepad2 size={18} fill="currentColor" /> ENTER DUEL MODE
                </button>
             </div>
             <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full group-hover:bg-emerald-500/20 transition-all duration-700"></div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 flex flex-col justify-between shadow-sm min-h-[200px]">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Game Modes</span>
              <p className="text-2xl font-black italic mt-2 text-slate-700 tracking-tighter">2 Active</p>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-widest border-t border-slate-200 pt-4">More Coming Soon</p>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 px-6 py-3 flex justify-between items-center z-50">
        {navLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`flex flex-col items-center gap-1 cursor-pointer ${
              location.pathname === link.path ? 'text-emerald-500' : 'text-slate-400'
            }`}
          >
            {link.icon}
            <span className="text-[10px] font-bold uppercase tracking-tighter">{link.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}