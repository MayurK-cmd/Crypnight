import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import API from '../../api/axios';
import { useWallet } from '../../wallet/WalletProvider';

const Toast = ({ message, type, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'error' ? 'bg-red-500' : 'bg-emerald-500';
  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50`}>
      {message}
    </div>
  );
};

const WalletLogin = () => {
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('connect'); // connect | sign
  const [nonce, setNonce] = useState(null);
  const navigate = useNavigate();
  const { connect, wallet, signMessage } = useWallet();

  const connectWallet = async () => {
    try {
      if (!wallet) {
        setToast({
          show: true,
          msg: 'Freighter wallet not found. Please install it.',
          type: 'error',
        });
        return;
      }

      setLoading(true);

      // Connect to wallet using the hook
      const address = await connect();
      // Extract the address string (Freighter returns an object with {address: "..."})
      const addressStr = typeof address === 'string' ? address : address.address;
      setWalletAddress(addressStr);

      // Get nonce from backend
      const response = await API.post('/wallet/nonce', {
        walletAddress: addressStr,
      });

      setNonce(response.data.nonce);
      setStep('sign');
      setToast({
        show: true,
        msg: 'Wallet connected! Now sign to verify ownership.',
        type: 'success',
      });
    } catch (err) {
      setToast({
        show: true,
        msg: err.response?.data?.error || 'Failed to connect wallet',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const signNonce = async () => {
    try {
      if (!wallet || !walletAddress || !nonce) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);

      // Sign the nonce with Freighter
      const signedMessage = await signMessage(nonce);

      // Verify signature with backend
      const response = await API.post('/wallet/verify', {
        walletAddress,
        signedMessage,
        nonce,
      });

      // Store token
      localStorage.setItem('auth_token', response.data.session.access_token);

      setToast({
        show: true,
        msg: 'Welcome back!',
        type: 'success',
      });

      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err) {
      setToast({
        show: true,
        msg: err.response?.data?.error || 'Failed to sign nonce',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>
      {toast.show && <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}

      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="font-extrabold text-xl tracking-tighter">
              crypnight<span className="text-emerald-500">.XLM</span>
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Welcome Back</h1>
          <p className="text-slate-500 font-medium">Sign in with your Stellar wallet</p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200">
          {step === 'connect' && (
            <div className="space-y-6">
              <button
                onClick={connectWallet}
                disabled={loading}
                className="w-full py-4 bg-black text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : '🔗'}
                {loading ? 'Connecting...' : 'Connect Freighter Wallet'}
              </button>
              <div className="text-xs text-slate-500 text-center">
                Connect your wallet to sign in to your account
              </div>
            </div>
          )}

          {step === 'sign' && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-emerald-600 uppercase mb-2">Connected Wallet</p>
                <p className="text-sm font-mono text-slate-700 break-all">{walletAddress}</p>
              </div>

              <button
                onClick={signNonce}
                disabled={loading}
                className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-lg hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : '✍️'}
                {loading ? 'Signing...' : 'Sign & Verify'}
              </button>

              <button
                onClick={() => {
                  setStep('connect');
                  setWalletAddress('');
                  setNonce(null);
                }}
                className="w-full py-3 bg-slate-200 text-slate-700 rounded-2xl font-semibold text-sm hover:bg-slate-300 transition-all"
              >
                Back
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-slate-500">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/signup')}
              className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors"
            >
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default WalletLogin;
