import { useEffect, useState } from "react";
import API from "../../api/axios";
import { useNavigate, Link } from "react-router-dom";
import { useWallet } from "../../wallet/WalletProvider";
import { User, Wallet, Shield, Calendar, ArrowLeft, Loader2 } from 'lucide-react';

const Toast = ({ message, type, onClose }) => (
  <div className="fixed bottom-10 right-10 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300">
    <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl ${
      type === 'error' ? 'bg-red-50/90 border-red-100 text-red-600' : 'bg-white/90 border-emerald-100 text-slate-900'
    }`}>
      <span className="text-lg">{type === 'error' ? '⚠️' : '✅'}</span>
      <span className="font-bold text-sm tracking-tight">{message}</span>
      <button onClick={onClose} className="ml-4 text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
    </div>
  </div>
);

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const [xlmBalance, setXlmBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const navigate = useNavigate();
  const { publicKey } = useWallet();

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await API.get("/user/profile");
        setProfile(res.data.profile);
      } catch (err) {
        showToast("Session expired. Please login.", "error");
        setTimeout(() => navigate("/login"), 2000);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [navigate]);

  useEffect(() => {
    if (publicKey) {
      setBalanceLoading(true);
      (async () => {
        try {
          const { Horizon } = await import("stellar-sdk");
          const server = new Horizon.Server("https://horizon-testnet.stellar.org");
          const account = await server.accounts().accountId(publicKey).call();
          const nativeBalance = account.balances.find(b => b.asset_type === 'native');
          setXlmBalance(nativeBalance ? parseFloat(nativeBalance.balance) : 0);
        } catch (err) {
          console.error('Failed to fetch balance:', err);
        } finally {
          setBalanceLoading(false);
        }
      })();
    }
  }, [publicKey]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans p-6 md:p-12 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>
      {toast.show && <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}

      <div className="max-w-3xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-500 hover:text-black font-bold mb-10 transition-colors group cursor-pointer">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
        </Link>

        <h2 className="text-5xl font-black tracking-tighter italic mb-10">Your Stats</h2>

        {profile && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Username Card */}
              <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] flex items-start gap-5 shadow-sm">
                <div className="p-4 bg-white rounded-2xl text-emerald-600 shadow-sm"><User size={24} /></div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Username</span>
                  <p className="text-xl font-black text-slate-900 mt-1 font-mono">
                    {profile.username || <span className="text-slate-400 italic">Not set</span>}
                  </p>
                </div>
              </div>

              {/* Wallet Card */}
              <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] flex items-start gap-5 shadow-sm">
                <div className="p-4 bg-white rounded-2xl text-emerald-600 shadow-sm"><Wallet size={24} /></div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Linked Wallet</span>
                  <p className="text-sm font-bold font-mono text-slate-600 mt-1 break-all">
                    {profile.wallet_address || "None Linked"}
                  </p>
                </div>
              </div>

              {/* Stellar XLM Balance Card */}
              <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] flex items-start gap-5 shadow-sm">
                <div className="p-4 bg-white rounded-2xl text-emerald-600 shadow-sm">★</div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Stellar Balance</span>
                  <p className="text-xl font-black text-emerald-600 mt-1 font-mono">
                    {balanceLoading ? <Loader2 size={20} className="animate-spin" /> : (xlmBalance !== null ? `${xlmBalance.toFixed(4)} XLM` : "N/A")}
                  </p>
                </div>
              </div>

              {/* Tier Card */}
              <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] flex items-start gap-5 shadow-sm">
                <div className="p-4 bg-white rounded-2xl text-emerald-600 shadow-sm"><Shield size={24} /></div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Current Rank</span>
                  <p className="text-xl font-black text-slate-900 mt-1 uppercase italic tracking-tighter">
                    {profile.tier || "No Tier"}
                  </p>
                </div>
              </div>
            </div>

            {/* Rating Details Area */}
            <div className="bg-slate-50 border border-slate-100 p-10 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row justify-between items-center gap-8">
               <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-3xl">🧩</div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight">ELO Rating: <span className="text-emerald-600">{profile.rating}</span></h3>
                    <p className="text-slate-500 font-medium">Joined on {new Date(profile.created_at).toLocaleDateString()}</p>
                  </div>
               </div>
               <button className="px-8 py-3 border-2 border-slate-200 rounded-xl font-bold hover:bg-slate-100 transition-colors cursor-pointer">
                  Refresh Metadata
               </button>
            </div>

            <div className="pt-8 text-center">
               <p className="text-xs text-slate-400 font-mono tracking-widest uppercase italic">UID: {profile.id}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

