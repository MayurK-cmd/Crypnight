import { useState } from 'react';
import API from '../../api/axios';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

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

// PHASE 1 §5.2 — password strength meter
const getPasswordStrength = (password) => {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score; // 0–5
};

// PHASE 6 §A — username validation. Mirrors the backend Joi rule:
// 3–20 chars, lowercase a-z + digits + underscore.
const USERNAME_RE = /^[a-z0-9_]+$/;
const validateUsername = (u) => {
  if (!u) return 'Pick a handle';
  if (u.length < 3) return 'At least 3 characters';
  if (u.length > 20) return 'At most 20 characters';
  if (!USERNAME_RE.test(u)) return 'Lowercase letters, digits, underscore only';
  return null;
};

const strengthLabel = ['', 'Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
const strengthColor = [
  '',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#16a34a',
];

export default function Signup() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const navigate = useNavigate();

  const usernameError = validateUsername(username);
  const usernameValid = username.length > 0 && usernameError === null;

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!email || !username || !password) return showToast("Please fill in all fields", "error");
    if (usernameError) return showToast(usernameError, "error");
    if (getPasswordStrength(password) < 4) {
      return showToast(
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
        "error"
      );
    }

    setIsLoading(true);
    try {
      const res = await API.post('/auth/signup', {
        email,
        username: username.toLowerCase(),
        password,
      });
      showToast(res.data.message);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const data = err.response?.data;
      const details = Array.isArray(data?.details) ? data.details : null;
      const msg = details ? `${data.error}: ${details.join(', ')}` : (data?.error || 'Signup failed');
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
          <h2 className="text-4xl font-black tracking-tight mb-2">Join the Arena</h2>
          <p className="text-slate-500 font-medium">Master your strategy, earn your XLM.</p>
        </div>

        <form onSubmit={handleSignup} className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] shadow-sm">
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="grandmaster@chess.XLM"
                className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Username</label>
              <input
                type="text"
                required
                placeholder="chess_king_1"
                pattern="[a-z0-9_]+"
                minLength={3}
                maxLength={20}
                value={username}
                className={`w-full bg-white border rounded-2xl px-5 py-4 text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all ${
                  usernameValid
                    ? 'border-emerald-500 focus:border-emerald-500'
                    : username.length > 0
                      ? 'border-red-300 focus:border-red-400'
                      : 'border-slate-200 focus:border-emerald-500'
                }`}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
              />
              {username.length > 0 && usernameError && (
                <p className="text-xs font-bold text-red-500 mt-1 ml-1">{usernameError}</p>
              )}
              {usernameValid && (
                <p className="text-xs font-bold text-emerald-600 mt-1 ml-1">Handle available</p>
              )}
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

            {password && (
              <div className="mt-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded"
                      style={{
                        background:
                          i <= getPasswordStrength(password)
                            ? strengthColor[getPasswordStrength(password)]
                            : '#e5e7eb',
                      }}
                    />
                  ))}
                </div>
                <p
                  className="text-xs mt-1 font-medium"
                  style={{ color: strengthColor[getPasswordStrength(password)] }}
                >
                  {strengthLabel[getPasswordStrength(password)]}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-black text-white rounded-2xl font-bold text-lg hover:bg-slate-800 disabled:bg-slate-700 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200 mt-2 cursor-pointer"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Create Account"}
            </button>
          </div>
        </form>

        <p className="text-center mt-8 text-slate-500 font-medium text-sm">
          Already a strategist? <Link to="/login" className="text-emerald-600 hover:text-emerald-500 font-bold underline underline-offset-4 cursor-pointer">Log in here</Link>
        </p>
      </div>
    </div>
  );
}
