import { useState } from "react";
import { useWallet } from "../../wallet/WalletProvider";
import API from "../../api/axios";
import { useNavigate } from "react-router-dom";

const Toast = ({ message, type, onClose }) => (
  <div className="fixed bottom-10 right-10 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300 text-left">
    <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl ${
      type === 'error' ? 'bg-red-50/90 border-red-100 text-red-600' : 'bg-white/90 border-emerald-100 text-slate-900'
    }`}>
      <span className="text-lg">{type === 'error' ? '⚠️' : '✅'}</span>
      <span className="font-bold text-sm tracking-tight">{message}</span>
      <button onClick={onClose} className="ml-4 text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
    </div>
  </div>
);

export default function Setup() {
  const { publicKey, connected, connect, signTransaction } = useWallet();
  const [tier, setTier] = useState("");
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const [connecting, setConnecting] = useState(false);
  const navigate = useNavigate();

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  };

  const handleConnectWallet = async () => {
    if (connected) return;
    setConnecting(true);
    try {
      await connect();
      showToast("Wallet connected!");
    } catch (err) {
      showToast("Failed to connect wallet. Ensure Freighter is installed.", "error");
    } finally {
      setConnecting(false);
    }
  };

  const linkWallet = async () => {
    if (!publicKey) return showToast("Connect wallet first", "error");
    try {
      const message = "Link wallet to CrypNight - Stellar";

      await API.post("/user/link-wallet", {
        walletAddress: publicKey,
        message,
      });

      showToast("Wallet linked & verified!");
    } catch (err) {
      showToast("Failed to link wallet", "error");
    }
  };

  const setUserTier = async () => {
    if (!tier) return showToast("Please select your skill tier", "error");
    try {
      await API.post("/user/set-tier", { tier });
      showToast("Profile finalized! Redirecting...");
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err) {
      showToast("Failed to set tier", "error");
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex items-center justify-center px-6 relative overflow-hidden text-left">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>
      {toast.show && <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}

      <div className="w-full max-w-2xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black tracking-tight mb-3">Finalize Your Profile</h2>
          <p className="text-slate-500 font-medium">Connect your Stellar identity and set your starting rank.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] flex flex-col items-center text-center shadow-sm">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-black mb-6">01</div>
            <h3 className="text-xl font-bold mb-2 text-slate-900">Identify</h3>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed font-medium">Connect your Freighter wallet to secure your earnings and profile.</p>

            <button
              onClick={handleConnectWallet}
              disabled={connected || connecting}
              className="w-full mb-4 py-3 bg-black text-white rounded-xl px-6 font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {connecting ? "Connecting..." : connected ? "✓ Connected" : "Connect Freighter"}
            </button>

            {connected && publicKey && (
              <>
                <p className="text-xs text-slate-500 mb-4 break-all">{publicKey.substring(0, 8)}...{publicKey.substring(publicKey.length - 8)}</p>
                <button
                  onClick={linkWallet}
                  className="text-xs font-black uppercase tracking-tighter text-emerald-600 hover:text-emerald-700 underline underline-offset-4 transition-all cursor-pointer"
                >
                  Verify Wallet
                </button>
              </>
            )}
          </div>

          <div className={`p-8 rounded-[2.5rem] flex flex-col items-center text-center transition-all duration-500 ${publicKey ? 'bg-slate-50 border border-slate-100 opacity-100 shadow-sm' : 'bg-slate-50/50 border border-dashed border-slate-200 opacity-50'}`}>
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-black mb-6">02</div>
            <h3 className="text-xl font-bold mb-2">Skill Level</h3>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed font-medium">Your initial ELO tier (cannot be changed later).</p>

            <select
              disabled={!publicKey}
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-4 text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 mb-6 appearance-none cursor-pointer font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select Level</option>
              <option value="beginner">Beginner (1000 ELO)</option>
              <option value="intermediate">Intermediate (1500 ELO)</option>
              <option value="professional">Professional (2000 ELO)</option>
              <option value="grandmaster">Grandmaster (2500 ELO)</option>
            </select>

            <button
              disabled={!publicKey || !tier}
              onClick={setUserTier}
              className="w-full py-4 bg-emerald-400 text-black rounded-2xl font-bold text-lg hover:bg-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl shadow-emerald-500/20 cursor-pointer"
            >
              Enter Dashboard
            </button>
          </div>
        </div>

        <p className="text-center mt-12 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
          Powered by Stellar Network
        </p>
      </div>
    </div>
  );
}
