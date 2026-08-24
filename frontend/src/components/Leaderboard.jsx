import { useEffect, useState } from 'react';
import API from '../api/axios.js';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';

const TIERS = [
  { id: 'global', label: 'Global' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'pro', label: 'Pro' },
  { id: 'gm', label: 'GM' },
];

export default function Leaderboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('global');
  const [rows, setRows] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const url =
          tab === 'global'
            ? '/leaderboard/global?limit=50'
            : `/leaderboard/tier/${tab}?limit=25`;
        const [boardRes, rankRes] = await Promise.all([
          API.get(url),
          API.get('/leaderboard/my-rank').catch(() => ({ data: null })),
        ]);
        if (cancelled) return;
        setRows(boardRes.data.leaderboard || []);
        setMyRank(rankRes.data || null);
      } catch (err) {
        if (!cancelled) console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans p-6 md:p-12 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40" />

      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-black font-bold mb-10 transition-colors group cursor-pointer"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>

        <h2 className="text-4xl md:text-5xl font-black tracking-tighter italic mb-2">
          Leaderboard
        </h2>
        <p className="text-slate-500 font-medium mb-8">
          Top players by tier and across the platform.
        </p>

        <div className="flex gap-2 mb-6 bg-slate-50 border border-slate-100 p-1 rounded-xl">
          {TIERS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                'flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors cursor-pointer ' +
                (tab === t.id
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-700')
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {myRank && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-700 font-bold">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mr-2">
              You
            </span>
            #{tab === 'global' ? myRank.global_rank : myRank.tier_rank ?? '—'} ·{' '}
            <span className="font-mono">{myRank.username || 'you'}</span> ·{' '}
            {myRank.rating} ELO
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-emerald-500" size={32} />
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="bg-slate-50 border border-slate-100 p-10 rounded-[2.5rem] text-center text-slate-400 font-bold">
            No ranked players yet for this view.
          </div>
        )}

        <div className="space-y-2">
          {rows.map((entry, i) => (
            <div
              key={entry.user_id}
              className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100"
            >
              <span
                className={
                  'w-8 text-center font-mono font-black ' +
                  (i === 0
                    ? 'text-yellow-500'
                    : i === 1
                    ? 'text-slate-500'
                    : i === 2
                    ? 'text-amber-700'
                    : 'text-slate-300')
                }
              >
                #{i + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-black italic text-slate-700 font-mono">
                  {entry.username || entry.wallet_short || 'anonymous'}
                </p>
                <p className="text-xs text-slate-400">
                  {entry.tier ? `${entry.tier} · ` : ''}{entry.puzzles_solved} solved · streak {entry.best_streak}
                </p>
              </div>
              <div className="text-right">
                <div className="font-mono font-black text-slate-700">
                  {entry.rating} ELO
                </div>
                <div className="text-xs font-black text-emerald-600">
                  {Number(entry.total_earned ?? 0).toFixed(3)} SOL
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
