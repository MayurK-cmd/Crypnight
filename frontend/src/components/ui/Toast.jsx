// Toast.jsx
export const Toast = ({ message, type, onClose }) => {
  return (
    <div className="fixed bottom-10 right-10 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl ${
        type === 'error' 
          ? 'bg-red-50/90 border-red-100 text-red-600' 
          : 'bg-white/90 border-emerald-100 text-slate-900'
      }`}>
        {type === 'error' ? '⚠️' : '✅'}
        <span className="font-bold text-sm tracking-tight">{message}</span>
        <button onClick={onClose} className="ml-4 text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
      </div>
    </div>
  );
};