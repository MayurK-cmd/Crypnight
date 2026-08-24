import { useNavigate } from 'react-router-dom';

const GameModes = () => {
  const navigate = useNavigate();

  return (
    <section id="modes" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold tracking-tight mb-4">Choose Your Path</h2>
          <p className="text-slate-500">Practice your pattern recognition or bet on your speed.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Solo Mode */}
          <div className="bg-white border-2 border-transparent hover:border-emerald-400 p-10 rounded-[2.5rem] transition-all group shadow-sm hover:shadow-xl">
            <div className="flex justify-between items-start mb-8">
              <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600 font-bold">🧩 Solo Speed</div>
              <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Skill-to-Earn</span>
            </div>
            <h3 className="text-2xl font-bold mb-4">Solo Practice</h3>
            <p className="text-slate-500 mb-8 text-sm">Solve random puzzles at your difficulty. Earn SOL rewards based on your solve time vs global averages.</p>
            <ul className="space-y-3 mb-10 text-sm font-medium">
              <li className="flex items-center gap-2">✅ Beginner to GM tiers</li>
              <li className="flex items-center gap-2">✅ No staking required</li>
              <li className="flex items-center gap-2">✅ Instant reward claim</li>
            </ul>
            <button
              onClick={() => navigate('/solo')}
              className="w-full py-4 bg-slate-100 rounded-2xl font-bold group-hover:bg-emerald-400 group-hover:text-black transition-all cursor-pointer"
            >
              Enter Practice
            </button>
          </div>

          {/* Duel Mode */}
          <div className="bg-black text-white p-10 rounded-[2.5rem] transition-all shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-[60px]"></div>
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div className="p-4 bg-white/10 rounded-2xl text-emerald-400 font-bold italic">⚔️ Duel Mode</div>
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">PvP Stakes</span>
            </div>
            <h3 className="text-2xl font-bold mb-4">Puzzle Duel</h3>
            <p className="text-slate-400 mb-8 text-sm">Face an opponent in real-time. High stakes, high reward. Only the fastest mind takes the pool.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-10">
              {[
                { tier: 'Beginner', stake: 0.05 },
                { tier: 'Intermediate', stake: 0.10 },
                { tier: 'Pro', stake: 0.25 },
                { tier: 'GM', stake: 0.50 }
              ].map(({tier, stake}) => (
                <div key={stake} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                  <span className="block text-[9px] text-slate-500 uppercase font-bold">{tier}</span>
                  <span className="text-sm font-bold text-emerald-400">{stake} SOL</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/duel')}
              className="w-full py-4 bg-emerald-400 text-black rounded-2xl font-bold hover:scale-[1.02] transition-transform relative z-10 cursor-pointer"
            >
              Find Match
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GameModes;