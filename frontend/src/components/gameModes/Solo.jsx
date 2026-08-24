import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import API from "../../api/axios";
import { useNavigate } from "react-router-dom";
import {
  Timer,
  Trophy,
  XCircle,
  Swords,
  ArrowLeft,
  CheckCircle2,
  Shield,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Coins,
  Heart,
} from "lucide-react";

const PUZZLES_PER_SESSION = parseInt(import.meta.env.VITE_PUZZLES_PER_SESSION || '10', 10);
const SESSION_LIVES = 3; // 3 puzzle-fails in a run ends the session.

export default function Solo() {
  const navigate = useNavigate();

  const chessRef = useRef(new Chess());
  const [position, setPosition] = useState("");
  const [puzzle, setPuzzle] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [moveFrom, setMoveFrom] = useState("");
  const [optionSquares, setOptionSquares] = useState({});
  const [lastMoveSquares, setLastMoveSquares] = useState({});
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(0);
  const hasFetched = useRef(false);
  const [popup, setPopup] = useState(null);
  const [playerColor, setPlayerColor] = useState(null);

  // PHASE 5 — session-level state
  const [puzzlesSolved, setPuzzlesSolved] = useState(0);
  const [puzzlesFailed, setPuzzlesFailed] = useState(0);
  const [puzzlesInSession, setPuzzlesInSession] = useState(0);
  const [totalReward, setTotalReward] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionEndReason, setSessionEndReason] = useState(null);
  const [summary, setSummary] = useState(null);
  const [txSignature, setTxSignature] = useState(null);

  const currentTurn =
    position && position.split(" ")[1] === "w" ? "White" : "Black";

  // ===============================
  // FETCH PUZZLE — single entry point
  // ===============================
  const fetchPuzzle = async () => {
    setLoading(true);
    setPopup(null);
    setTimer(0);
    setLastMoveSquares({});
    setOptionSquares({});
    setMoveFrom("");

    try {
      const puzzleRes = await API.get("/puzzle");
      const raw = puzzleRes.data.puzzle;
      const sid = puzzleRes.data.session_id;
      const autoPlayedMove = puzzleRes.data.auto_played_move;

      const fetchedPuzzle = {
        puzzle_id: raw.puzzle_id || raw.PuzzleId,
        fen: raw.fen || raw.FEN,
        rating: raw.rating || raw.Rating,
        themes: raw.themes || raw.Themes,
      };

      let activeSessionId = sid;
      if (!activeSessionId) {
        const sessionRes = await API.post("/solo/start", {});
        activeSessionId = sessionRes.data.session_id;
        setPuzzlesInSession(sessionRes.data.puzzles_in_session || 1);
        setPuzzlesSolved(sessionRes.data.puzzles_solved || 0);
        setPuzzlesFailed(sessionRes.data.puzzles_failed || 0);
        setTotalReward(sessionRes.data.total_session_reward || 0);
      } else {
        setPuzzlesInSession(puzzleRes.data.puzzles_in_session || 1);
        setPuzzlesSolved(puzzleRes.data.puzzles_solved || 0);
        setPuzzlesFailed(puzzleRes.data.puzzles_failed || 0);
      }

      setSessionId(activeSessionId);
      setPuzzle(fetchedPuzzle);

      const game = new Chess(fetchedPuzzle.fen);
      chessRef.current = game;
      setPosition(game.fen());

      // Parse player color from FEN second token: 'w' = white, 'b' = black
      const activeColor = fetchedPuzzle.fen.split(' ')[1];
      setPlayerColor(activeColor === 'w' ? 'white' : 'black');

      // Display auto-played move with yellow highlighting
      if (autoPlayedMove) {
        const autoFrom = autoPlayedMove.slice(0, 2);
        const autoTo = autoPlayedMove.slice(2, 4);
        setLastMoveSquares({
          [autoFrom]: { background: "rgba(255, 200, 87, 0.5)" },
          [autoTo]: { background: "rgba(255, 152, 0, 0.6)" },
        });
      }

      setLoading(false);
    } catch (err) {
      console.error("Failed to load puzzle:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchPuzzle();
  }, []);

  // Session timer (display only — server enforces the 10-min cap).
  useEffect(() => {
    if (!sessionId || sessionComplete) return;
    setTimer(0);
    const interval = setInterval(() => setTimer((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [sessionId, sessionComplete]);

  // ===============================
  // MOVE OPTIONS — green dots (only for player color)
  // ===============================
  function getMoveOptions(square) {
    const game = chessRef.current;
    const piece = game.get(square);

    // Only show moves for the player's color
    if (!piece || (playerColor === 'white' && piece.color !== 'w') || (playerColor === 'black' && piece.color !== 'b')) {
      setOptionSquares({});
      return false;
    }

    const moves = game.moves({ square, verbose: true });

    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares = {};
    for (const move of moves) {
      newSquares[move.to] = {
        background:
          game.get(move.to) && game.get(move.to)?.color !== game.get(square)?.color
            ? "radial-gradient(circle, rgba(16,185,129,0.6) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(16,185,129,0.6) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    }
    newSquares[square] = { background: "rgba(16, 185, 129, 0.4)" };
    setOptionSquares(newSquares);
    return true;
  }

  // ===============================
  // CLICK MOVE SUPPORT
  // ===============================
  async function onSquareClick({ square, piece }) {
    if (sessionComplete) return;
    const game = chessRef.current;

    if (!moveFrom && piece) {
      const hasMoveOptions = getMoveOptions(square);
      if (hasMoveOptions) setMoveFrom(square);
      return;
    }

    const moves = game.moves({ square: moveFrom, verbose: true });
    const foundMove = moves.find((m) => m.from === moveFrom && m.to === square);

    if (!foundMove) {
      const hasMoveOptions = getMoveOptions(square);
      setMoveFrom(hasMoveOptions ? square : "");
      return;
    }

    setOptionSquares({});
    await handleMove(moveFrom, square);
    setMoveFrom("");
  }

  // ===============================
  // BACKEND SECURE MOVE HANDLER
  // ===============================
  const handleMove = async (from, to) => {
    if (sessionComplete) return false;
    const game = chessRef.current;

    const move = game.move({ from, to, promotion: "q" });
    if (!move) return false;

    setPosition(game.fen());
    setOptionSquares({});
    setLastMoveSquares({
      [from]: { background: "rgba(255, 200, 87, 0.5)" },
      [to]: { background: "rgba(255, 152, 0, 0.6)" },
    });

    try {
      const res = await API.post("/solo/move", {
        session_id: sessionId,
        move: from + to,
      });

      if (!res.data.correct) {
        game.undo();
        setPosition(game.fen());
        setLastMoveSquares({});

        setPuzzlesFailed(res.data.puzzles_failed ?? puzzlesFailed + 1);
        setPuzzlesInSession(res.data.puzzles_in_session ?? puzzlesInSession + 1);

        if (res.data.session_complete) {
          handleSessionComplete(res.data);
          return false;
        }

        const livesLeft = res.data.lives_remaining ?? Math.max(0, SESSION_LIVES - (res.data.puzzles_failed ?? 0));
        setPopup({
          type: "fail",
          message: livesLeft > 0
            ? `Wrong move. ${livesLeft} ${livesLeft === 1 ? 'life' : 'lives'} left.`
            : 'Wrong move.',
        });
        setTimeout(() => {
          setPopup(null);
          fetchPuzzle();
        }, 1800);
        return false;
      }

      if (res.data.finished) {
        const submitRes = await API.post("/solo/submit", { session_id: sessionId });
        setPuzzlesSolved(submitRes.data.puzzles_solved);
        setPuzzlesInSession(submitRes.data.puzzles_in_session);
        setPuzzlesFailed(submitRes.data.puzzles_failed);
        setTotalReward(submitRes.data.total_session_reward);

        if (submitRes.data.session_complete) {
          handleSessionComplete(submitRes.data);
          return true;
        }

        setPopup({
          type: "success",
          message: `Solved! +${Number(submitRes.data.reward).toFixed(6)} SOL`,
        });
        setTimeout(() => {
          setPopup(null);
          fetchPuzzle();
        }, 1800);
        return true;
      }

      // Correct move, opponent replies
      const opponentMove = res.data.opponent_move;
      const oppFrom = opponentMove.slice(0, 2);
      const oppTo = opponentMove.slice(2, 4);
      game.move({ from: oppFrom, to: oppTo, promotion: opponentMove[4] || "q" });

      setLastMoveSquares({
        [oppFrom]: { background: "rgba(255, 200, 87, 0.5)" },
        [oppTo]: { background: "rgba(255, 152, 0, 0.6)" },
      });
      setPosition(game.fen());
      return true;

    } catch (err) {
      game.undo();
      setPosition(game.fen());
      setLastMoveSquares({});
      return false;
    }
  };

  // ===============================
  // DRAG SUPPORT
  // ===============================
  async function onPieceDrop({ sourceSquare, targetSquare }) {
    if (!targetSquare || sessionComplete) return false;
    setOptionSquares({});
    setMoveFrom("");
    return await handleMove(sourceSquare, targetSquare);
  }

  const handleSessionComplete = (data) => {
    setSessionComplete(true);
    setSessionEndReason(data.session_end_reason || null);
    setSummary({
      new_rating: data.new_rating,
      session_rating_delta: data.session_rating_delta,
      puzzles_solved: data.puzzles_solved,
      puzzles_failed: data.puzzles_failed,
      total_session_reward: data.total_session_reward,
    });
    setTxSignature(data.txSignature || null);
  };

  const startNewRun = async () => {
    setSessionComplete(false);
    setSessionEndReason(null);
    setSummary(null);
    setSessionId(null);
    setPuzzle(null);
    setPosition("");
    setPuzzlesSolved(0);
    setPuzzlesFailed(0);
    setPuzzlesInSession(0);
    setTotalReward(0);
    setTxSignature(null);
    setPlayerColor(null);
    await fetchPuzzle();
  };

  if (loading || (!position && !sessionComplete)) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="font-black italic tracking-tighter text-slate-400 uppercase tracking-widest">
          Entering Arena...
        </p>
      </div>
    );
  }

  // ===============================
  // SESSION COMPLETE — final summary
  // ===============================
  if (sessionComplete && summary) {
    const delta = summary.session_rating_delta || 0;
    const DeltaIcon = delta >= 0 ? TrendingUp : TrendingDown;
    const deltaColor = delta >= 0 ? 'text-emerald-600' : 'text-red-500';
    const perfectRun = summary.puzzles_failed === 0;
    const livesExhausted = sessionEndReason === 'fail_cap';
    const headline = livesExhausted
      ? 'Lives Exhausted'
      : perfectRun
        ? 'Flawless Victory'
        : 'Run Ended';

    return (
      <div className="min-h-screen bg-white text-slate-900 font-sans p-4 md:p-8 lg:p-12 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px:32px] opacity-40" />

        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-slate-400 hover:text-black font-bold transition-all mb-8 group cursor-pointer"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </button>

          <div className="bg-slate-900 rounded-[3rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl shadow-slate-200">
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-emerald-500/20 blur-[100px] rounded-full" />

            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-2">
                Run Complete
              </p>
              <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter mb-2">
                {headline}
              </h2>
              <p className="text-slate-400 text-sm font-medium mb-10">
                {livesExhausted
                  ? `3 puzzle-fails — the run is over. ${summary.puzzles_solved} solved.`
                  : `${summary.puzzles_solved} solved · ${summary.puzzles_failed} failed`}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <Coins size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Total Earned</span>
                  </div>
                  <p className="text-4xl font-black italic tracking-tighter">
                    +{Number(summary.total_session_reward).toFixed(6)}
                  </p>
                  <p className="text-xs text-slate-400 font-bold mt-1">SOL</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className={`flex items-center gap-2 mb-2 ${deltaColor}`}>
                    <DeltaIcon size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Rating Change</span>
                  </div>
                  <p className="text-4xl font-black italic tracking-tighter">
                    {summary.new_rating}
                  </p>
                  <p className={`text-xs font-black mt-1 ${deltaColor}`}>
                    {delta >= 0 ? '+' : ''}{delta} ELO
                  </p>
                </div>
              </div>

              {txSignature && (
                <a
                  href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer mb-6 underline underline-offset-2 transition-colors"
                >
                  View payout on Solana Explorer ↗
                </a>
              )}

              {!txSignature && summary.total_session_reward > 0 && (
                <p className="text-xs text-yellow-500 mb-6">
                  Reward recorded — on-chain payout processing
                </p>
              )}

              <button
                onClick={startNewRun}
                className="w-full bg-emerald-400 text-black py-4 rounded-2xl font-black text-lg hover:bg-emerald-300 transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw size={18} /> Start a New Run
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===============================
  // IN-PROGRESS SESSION
  // ===============================
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans p-4 md:p-8 lg:p-12 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* LEFT */}
        <div className="lg:col-span-3 space-y-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-slate-400 hover:text-black font-bold transition-all mb-4 cursor-pointer"
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>

          <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-emerald-600">
              <Trophy size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Puzzle Rating</span>
            </div>
            <p className="text-5xl font-black italic tracking-tighter">{puzzle?.rating || 0}</p>
          </div>

          {/* PHASE 5 — session stats panel */}
          <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl">
            <div className="flex items-center gap-3 mb-4 text-emerald-400">
              <Swords size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Session Stats</span>
            </div>
            <p className="text-3xl font-black italic tracking-tighter mb-1">
              Puzzle {puzzlesInSession || 1} <span className="text-slate-500">/ {PUZZLES_PER_SESSION}</span>
            </p>
            <div className="flex gap-3 mt-4">
              <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Solved</p>
                <p className="text-2xl font-black italic">{puzzlesSolved}</p>
              </div>
              <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Failed</p>
                <p className="text-2xl font-black italic">{puzzlesFailed}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Session Earnings</p>
              <p className="text-2xl font-black italic text-emerald-400">
                +{Number(totalReward).toFixed(6)} <span className="text-sm text-slate-500">SOL</span>
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <Heart size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Session Lives</span>
            </div>
            <div className="flex gap-2 mb-4">
              {[...Array(SESSION_LIVES)].map((_, i) => (
                <div
                  key={i}
                  className={`h-2.5 flex-1 rounded-full ${
                    i < SESSION_LIVES - puzzlesFailed
                      ? "bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.4)]"
                      : "bg-slate-200"
                  } transition-all duration-500`}
                />
              ))}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
              {SESSION_LIVES - puzzlesFailed} / {SESSION_LIVES} Lives Left
            </p>
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed italic">
              One wrong move ends the puzzle. {SESSION_LIVES} puzzle-fails ends the run.
            </p>
          </div>
        </div>

        {/* MIDDLE */}
        <div className="lg:col-span-6">
          <div className="bg-white p-6 md:p-10 rounded-[3.5rem] shadow-2xl shadow-slate-200 border border-slate-100 relative overflow-hidden">

            {popup && (
              <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-xl ${
                  popup.type === "success" ? "bg-emerald-100 text-emerald-600" : "bg-red-50 text-red-500"
                }`}>
                  {popup.type === "success" ? <CheckCircle2 size={40} /> : <XCircle size={40} />}
                </div>
                <h2 className={`text-4xl font-black italic tracking-tighter uppercase ${
                  popup.type === "success" ? "text-emerald-600" : "text-red-500"
                }`}>
                  {popup.type === "success" ? "Puzzle Solved" : "Failed"}
                </h2>
                <p className="text-slate-500 font-bold mt-2 text-lg">{popup.message}</p>
              </div>
            )}

            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className={`w-3.5 h-3.5 rounded-full animate-pulse ${
                  currentTurn === "White"
                    ? "bg-slate-200 border border-slate-300"
                    : "bg-black shadow-lg shadow-black/20"
                }`} />
                <span className="text-xs font-black uppercase tracking-[0.15em] italic">
                  {currentTurn} to move
                </span>
              </div>
              <div className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl font-mono text-sm shadow-xl shadow-slate-400">
                <Timer size={16} className="text-emerald-400" />
                {timer}s
              </div>
            </div>

            <div className="w-full max-w-[500px] mx-auto rounded-2xl overflow-hidden border-[12px] border-slate-50 shadow-inner">
              <Chessboard
                boardOrientation={playerColor}
                options={{
                  position,
                  onSquareClick,
                  onPieceDrop,
                  squareStyles: { ...lastMoveSquares, ...optionSquares },
                  id: "solo-board",
                  arePiecesDraggable: (piece) => {
                    if (!playerColor) return false;
                    return playerColor === 'white' ? piece.color === 'w' : piece.color === 'b';
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-xl relative overflow-hidden group">
            <Swords className="text-emerald-400 mb-6" size={32} />
            <h3 className="text-2xl font-black italic tracking-tighter mb-2 uppercase italic">Solo Mode</h3>
            <p className="text-slate-400 text-[10px] font-bold leading-relaxed uppercase tracking-[0.2em] mb-8">
              Skill-to-Earn Active
            </p>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
              <p className="text-[10px] text-slate-300 leading-relaxed font-medium">
                Solve up to {PUZZLES_PER_SESSION} puzzles per run. One wrong move ends a puzzle — {SESSION_LIVES} puzzle-fails ends the run.
              </p>
            </div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-500/10 blur-[60px] rounded-full group-hover:bg-emerald-500/20 transition-all duration-700" />
          </div>

          <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-slate-400">
              <Shield size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Anti-Cheat</span>
            </div>
            <p className="text-xs text-slate-500 font-medium italic leading-relaxed">
              Moves are verified by the backend engine. Solutions are never sent to your browser.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
