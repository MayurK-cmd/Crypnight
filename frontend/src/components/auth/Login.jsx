import { useState, useContext } from 'react';
import API from '../../api/axios';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';

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

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await API.post('/auth/login', { email, password });
      // PHASE 1 §4 — the httpOnly cookie is set automatically. We just record
      // the returned user in context and let the router decide where to go.
      login(res.data.user);
      showToast("Access Granted. Loading your stats...");
      setTimeout(() => navigate('/redirect'), 1000);
    } catch (err) {
      const data = err.response?.data;
      const details = Array.isArray(data?.details) ? data.details : null;
      const msg = details ? `${data.error}: ${details.join(', ')}` : (data?.error || 'Invalid credentials');
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>
      {toast.show && <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}

      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl">C</span>
            </div>
            <span className="font-extrabold text-2xl tracking-tighter">
              crypnight<span className="text-emerald-500">.XLM</span>
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-2">Welcome Back</h1>
          <p className="text-slate-500 font-medium">Your next move is waiting.</p>
        </div>

        <form onSubmit={handleLogin} className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] shadow-sm relative">
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Email</label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Password</label>
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 pr-12 text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-[42px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-emerald-400 text-black rounded-2xl font-bold text-lg hover:bg-emerald-300 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 mt-2 cursor-pointer"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Enter App"}
            </button>
          </div>
        </form>

        <p className="text-center mt-8 text-slate-500 font-medium text-sm">
          New to the club? <Link to="/signup" className="text-emerald-600 hover:text-emerald-500 font-bold underline underline-offset-4 cursor-pointer">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
