import { useEffect, useRef, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useWallet } from "../../wallet/WalletProvider";
import StellarSdk from "stellar-sdk";
import API from "../../api/axios";
import { AuthContext } from "../../context/AuthContext";
import { useDuelSocket } from "../../hooks/useDuelSocket";
import {
  Timer,
  Trophy,
  XCircle,
  Swords,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Coins,
} from "lucide-react";

const TIER_LABELS = {
  beginner: "Beginner (0.5 XLM)",
  intermediate: "Intermediate (1.0 XLM)",
  pro: "Pro (2.5 XLM)",
  gm: "Grandmaster (5.0 XLM)",
};

const STAKE_STROOPS = {
  beginner: 5_000_000,
  intermediate: 10_000_000,
  pro: 25_000_000,
  gm: 50_000_000,
};

const STELLAR_TESTNET = {
  networkPassphrase: StellarSdk.Networks.TESTNET_NETWORK_PASSPHRASE,
  horizon: "https://horizon-testnet.stellar.org",
};

export default function Duel() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { publicKey, sendTransaction } = useWallet();

  // State machine: 'tier_select' | 'queuing' | 'match_found' | 'waiting_both' | 'game' | 'ended'
  const [state, setState] = useState("tier_select");
  const [selectedTier, setSelectedTier] = useState("beginner");
  const [matchId, setMatchId] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [playerRole, setPlayerRole] = useState(null); // 'player_a' or 'player_b'
  const [opponentDeposited, setOpponentDeposited] = useState(false);
  const [playerDeposited, setPlayerDeposited] = useState(false);
  const [bothDeposited, setBothDeposited] = useState(false);
  const [gameState, setGameState] = useState(null);

  // Chess state
  const chessRef = useRef(new Chess());
  const [position, setPosition] = useState("");
  const [puzzle, setPuzzle] = useState(null);
  const [moveFrom, setMoveFrom] = useState("");
  const [optionSquares, setOptionSquares] = useState({});
  const [lastMoveSquares, setLastMoveSquares] = useState({});
  const [playerColor, setPlayerColor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(180);

  // Game progress
  const [puzzlesSolved, setPuzzlesSolved] = useState(0);
  const [puzzlesFailed, setPuzzlesFailed] = useState(0);
  const [opponentPuzzlesSolved, setOpponentPuzzlesSolved] = useState(0);
  const [opponentPuzzlesFailed, setOpponentPuzzlesFailed] = useState(0);
  const [playerLives, setPlayerLives] = useState(3);
  const [opponentLives, setOpponentLives] = useState(3);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [result, setResult] = useState(null);
  const [txSignature, setTxSignature] = useState(null);

  const currentTurn =
    position && position.split(" ")[1] === "w" ? "White" : "Black";

  const { socket, joinQueue, confirmDeposit, startDuel, submitMove, onMatchFound, onDuelStart, onNewPuzzle, onPuzzleSolved, onPuzzleFailed, onOpponentReply, onDuelEnded } = useDuelSocket();

  // Tier selection
  const handleTierSelect = (tier) => {
    setSelectedTier(tier);
    setState("queuing");
    joinQueue(tier);
  };

  // Match found listener
  useEffect(() => {
    if (!socket) return;

    const handleMatchFound = ({ matchId: mid, tier, stakeSol, opponent: opp, yourWallet, role }) => {
      setMatchId(mid);
      setOpponent(opp);
      setPlayerRole(role);
      setState("match_found");
    };

    onMatchFound(handleMatchFound);
  }, [socket, onMatchFound]);

  // Opponent deposit listener
  useEffect(() => {
    if (!socket) return;

    const handleOpponentReply = (data) => {
      if (data.type === 'both:deposited') {
        setOpponentDeposited(true);
        setBothDeposited(true);
      } else if (data.type === 'opponent:deposited') {
        setOpponentDeposited(true);
      }
    };

    onOpponentReply(handleOpponentReply);
  }, [socket, onOpponentReply]);

  // Start duel handler
  const handleStartDuel = () => {
    if (!matchId) return;
    startDuel(matchId);
  };

  // Confirm & Stake
  const handleConfirmStake = async () => {
    if (!publicKey || !matchId) return;

    try {
      setState("waiting_both");
      const escrowAccount = import.meta.env.VITE_DUEL_ESCROW_ACCOUNT;

      const server = new StellarSdk.Server(STELLAR_TESTNET.horizon);
      const sourceAccount = await server.loadAccount(publicKey);

      const stakeStroops = STAKE_STROOPS[selectedTier];
      const baseFeeFraction = await server.fetchBaseFee();
      const baseFee = Math.ceil(baseFeeFraction * 100);

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: baseFee,
        networkPassphrase: STELLAR_TESTNET.networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: escrowAccount,
            asset: StellarSdk.Asset.native(),
            amount: (stakeStroops / 10_000_000).toString(),
          })
        )
        .setTimeout(300)
        .build();

      const signedTx = await signTransaction(transaction.toXDR());
      const txResponse = await server.submitTransaction(
        new StellarSdk.Transaction(signedTx, STELLAR_TESTNET.networkPassphrase)
      );

      setPlayerDeposited(true);
      confirmDeposit(matchId, txResponse.id);
    } catch (err) {
      console.error("Stake error:", err);
      setState("match_found");
    }
  };

  // Duel start listener
  useEffect(() => {
    if (!socket) return;

    const handleDuelStart = ({ puzzle: puz, autoPlayedMove, durationMs, startedAt }) => {
      setState("game");

      // Initialize game with puzzle FEN
      const game = new Chess(puz.fen);
      chessRef.current = game;
      setPosition(game.fen());
      setPuzzle({
        puzzle_id: puz.puzzle_id,
        fen: puz.fen,
        rating: puz.rating,
      });

      // Determine player color from FEN's second token
      const activeColor = puz.fen.split(' ')[1];
      setPlayerColor(activeColor === 'w' ? 'white' : 'black');

      // Display auto-played move with yellow highlighting
      if (autoPlayedMove) {
        const autoFrom = autoPlayedMove.slice(0, 2);
        const autoTo = autoPlayedMove.slice(2, 4);
        setLastMoveSquares({
          [autoFrom]: { background: 'rgba(255, 200, 87, 0.5)' },
          [autoTo]: { background: 'rgba(255, 152, 0, 0.6)' },
        });
      }

      setTimer(Math.ceil(durationMs / 1000));
    };

    onDuelStart(handleDuelStart);
  }, [socket, onDuelStart]);

  // Puzzle solved listener
  useEffect(() => {
    if (!socket) return;

    const handlePuzzleSolved = ({ matchId: mid }) => {
      if (mid !== matchId) return;
      setPuzzlesSolved(prev => prev + 1);
    };

    onPuzzleSolved(handlePuzzleSolved);
  }, [socket, onPuzzleSolved, matchId]);

  // Puzzle failed listener
  useEffect(() => {
    if (!socket) return;

    const handlePuzzleFailed = ({ matchId: mid, livesRemaining }) => {
      if (mid !== matchId) return;
      setPuzzlesFailed(prev => prev + 1);
      setPlayerLives(livesRemaining);
    };

    onPuzzleFailed(handlePuzzleFailed);
  }, [socket, onPuzzleFailed, matchId]);

  // New puzzle listener
  useEffect(() => {
    if (!socket) return;

    const handleNewPuzzle = ({ matchId: mid, puzzle: puz, autoPlayedMove }) => {
      if (mid !== matchId) return;

      const game = new Chess(puz.fen);
      chessRef.current = game;
      setPosition(game.fen());
      setPuzzle({
        puzzle_id: puz.puzzle_id,
        fen: puz.fen,
        rating: puz.rating,
      });

      // Determine player color from FEN's second token
      const activeColor = puz.fen.split(' ')[1];
      setPlayerColor(activeColor === 'w' ? 'white' : 'black');

      // Display auto-played move with yellow highlighting
      if (autoPlayedMove) {
        const autoFrom = autoPlayedMove.slice(0, 2);
        const autoTo = autoPlayedMove.slice(2, 4);
        setLastMoveSquares({
          [autoFrom]: { background: 'rgba(255, 200, 87, 0.5)' },
          [autoTo]: { background: 'rgba(255, 152, 0, 0.6)' },
        });
      } else {
        setLastMoveSquares({});
      }
    };

    onNewPuzzle(handleNewPuzzle);
  }, [socket, onNewPuzzle, matchId]);

  // Progress listener for opponent moves
  useEffect(() => {
    if (!socket) return;

    const handleOpponentMove = (data) => {
      if (data.type === 'opponent:solved_puzzle') {
        setOpponentPuzzlesSolved(prev => prev + 1);
      } else if (data.type === 'opponent:failed_puzzle') {
        setOpponentPuzzlesFailed(prev => prev + 1);
        if (data.opponentLivesRemaining !== undefined) {
          setOpponentLives(data.opponentLivesRemaining);
        }
      } else if (data.type === 'move:valid' && state === 'game') {
        // My move was valid - auto-play the next move in solution
        const game = chessRef.current;
        if (data.opponentMove) {
          const autoFrom = data.opponentMove.slice(0, 2);
          const autoTo = data.opponentMove.slice(2, 4);
          game.move({ from: autoFrom, to: autoTo, promotion: data.opponentMove[4] || 'q' });
          setPosition(game.fen());
          setLastMoveSquares({
            [autoFrom]: { background: 'rgba(255, 200, 87, 0.5)' },
            [autoTo]: { background: 'rgba(255, 152, 0, 0.6)' },
          });
        }
      } else if (data.type === 'opponent:moved' && state === 'game') {
        const game = chessRef.current;

        // Auto-play opponent's move
        if (data.move) {
          const oppFrom = data.move.slice(0, 2);
          const oppTo = data.move.slice(2, 4);
          game.move({ from: oppFrom, to: oppTo, promotion: data.move[4] || 'q' });
          setPosition(game.fen());
          setLastMoveSquares({
            [oppFrom]: { background: 'rgba(255, 200, 87, 0.5)' },
            [oppTo]: { background: 'rgba(255, 152, 0, 0.6)' },
          });
        }

        // Auto-play next move in solution (opponent's auto-move)
        if (data.opponentMove) {
          const autoFrom = data.opponentMove.slice(0, 2);
          const autoTo = data.opponentMove.slice(2, 4);
          game.move({ from: autoFrom, to: autoTo, promotion: data.opponentMove[4] || 'q' });
          setPosition(game.fen());
        }
      } else if (data.type === 'duel:out_of_lives') {
        // I ran out of lives - show blur screen and wait
        setPlayerLives(0);
      } else if (data.type === 'opponent:out_of_lives') {
        // Opponent ran out of lives - I win
        setSessionComplete(true);
        setResult({
          reason: 'opponent_out_of_lives',
          isDraw: false,
          winnerId: user?.id,
          playerASolved: puzzlesSolved,
          playerBSolved: opponentPuzzlesSolved,
        });
        setState("ended");

        // Call settlement endpoint
        API.post('/duel/settle', {
          matchId,
          playerASolved: puzzlesSolved,
          playerBSolved: opponentPuzzlesSolved,
        }).catch(() => {
          // Settlement handled on backend
        });
      }
    };

    onOpponentReply(handleOpponentMove);
  }, [socket, onOpponentReply, state, matchId]);

  // Game timer
  useEffect(() => {
    if (state !== "game" || sessionComplete) return;

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          // Time's up — determine winner
          const isDraw = puzzlesSolved === opponentPuzzlesSolved;
          const winnerId = !isDraw ? (puzzlesSolved > opponentPuzzlesSolved ? user?.id : null) : null;

          setSessionComplete(true);
          const gameResult = {
            reason: 'time_expired',
            isDraw,
            winnerId,
            playerASolved: puzzlesSolved,
            playerBSolved: opponentPuzzlesSolved,
          };
          setResult(gameResult);
          setState("ended");

          // Call settlement endpoint
          API.post('/duel/settle', {
            matchId,
            playerASolved: puzzlesSolved,
            playerBSolved: opponentPuzzlesSolved,
          }).catch(() => {
            // Settlement handled on backend
          });

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state, sessionComplete, puzzlesSolved, opponentPuzzlesSolved, user?.id, matchId]);

  // Duel ended listener
  useEffect(() => {
    if (!socket) return;

    const handleDuelEnded = ({ reason, isDraw, winnerId, playerA, playerB }) => {
      setSessionComplete(true);
      setResult({
        reason,
        isDraw,
        winnerId,
        playerASolved: playerA?.puzzlesSolved || 0,
        playerAFailed: playerA?.puzzlesFailed || 0,
        playerBSolved: playerB?.puzzlesSolved || 0,
        playerBFailed: playerB?.puzzlesFailed || 0,
      });
      setState("ended");
    };

    onDuelEnded(handleDuelEnded);
  }, [socket, onDuelEnded]);

  const initializeGame = (puz) => {
    const game = new Chess(puz.fen);
    chessRef.current = game;
    setPosition(game.fen());
    setPuzzle({
      puzzle_id: puz.puzzle_id || puz.PuzzleId,
      fen: puz.fen || puz.FEN,
      rating: puz.rating || puz.Rating,
    });

    const activeColor = puz.fen.split(" ")[1];
    setPlayerColor(activeColor === "w" ? "white" : "black");
    setLoading(false);
  };

  function getMoveOptions(square) {
    const game = chessRef.current;
    const piece = game.get(square);

    if (!piece || (playerColor === "white" && piece.color !== "w") || (playerColor === "black" && piece.color !== "b")) {
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

  async function onSquareClick({ square }) {
    if (sessionComplete || playerLives <= 0) return;
    const game = chessRef.current;

    if (!moveFrom) {
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

  async function handleMove(from, to) {
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
      submitMove(matchId, from + to);
      return true;
    } catch (err) {
      console.error('[Duel] Move submission error:', err);
      game.undo();
      setPosition(game.fen());
      setLastMoveSquares({});
      return false;
    }
  }

  async function onPieceDrop({ sourceSquare, targetSquare }) {
    if (!targetSquare || sessionComplete || playerLives <= 0) return false;
    setOptionSquares({});
    setMoveFrom("");
    return await handleMove(sourceSquare, targetSquare);
  }

  // ===============================
  // TIER SELECT
  // ===============================
  if (state === "tier_select") {
    return (
      <div className="min-h-screen bg-white text-slate-900 font-sans p-4 md:p-8 lg:p-12 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>

        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-slate-400 hover:text-black font-bold transition-all mb-8 group cursor-pointer"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </button>

          <div className="mb-12">
            <h1 className="text-4xl font-black tracking-tight mb-2">⚔️ Challenge Mode</h1>
            <p className="text-slate-600">Select your tier and find an opponent</p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:gap-6">
            {Object.entries(TIER_LABELS).map(([tier, label]) => (
              <button
                key={tier}
                onClick={() => handleTierSelect(tier)}
                className="bg-gradient-to-br from-slate-100 to-slate-50 border-2 border-slate-200 hover:border-emerald-500 rounded-2xl p-6 text-left transition-all transform hover:scale-105 cursor-pointer"
              >
                <div className="text-xs font-black uppercase tracking-widest text-slate-600 mb-2 capitalize">
                  {tier}
                </div>
                <div className="text-lg font-black text-slate-900">{label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ===============================
  // QUEUING
  // ===============================
  if (state === "queuing") {
    return (
      <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
        <p className="font-black italic tracking-tighter text-slate-400 uppercase tracking-widest">
          Finding Opponent...
        </p>
      </div>
    );
  }

  // ===============================
  // MATCH FOUND
  // ===============================
  if (state === "match_found") {
    return (
      <div className="min-h-screen bg-white text-slate-900 font-sans p-4 md:p-8 lg:p-12 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>

        <div className="max-w-2xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl font-black tracking-tight mb-2">Match Found!</h1>
            <p className="text-slate-600">Opponent ready. Confirm your stake to begin.</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-3xl p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="text-center">
                <div className="text-sm text-slate-600 font-bold mb-2">You</div>
                <div className="text-2xl font-black">{user?.username || "Player"}</div>
              </div>

              <div className="text-center">
                <div className="text-4xl">⚔️</div>
                <div className="text-xs text-slate-600 font-bold mt-2">vs</div>
              </div>

              <div className="text-center">
                <div className="text-sm text-slate-600 font-bold mb-2">Opponent</div>
                <div className="text-2xl font-black">{opponent?.username || "?"}</div>
                <div className="text-xs text-slate-500 mt-1">{opponent?.rating || 1500} ELO</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 text-center mb-6">
              <div className="text-xs text-slate-600 font-bold mb-1">Stake Amount</div>
              <div className="text-3xl font-black text-emerald-600">{(STAKE_LAMPORTS[selectedTier] / 1e9).toFixed(2)} SOL</div>
            </div>

            <button
              onClick={handleConfirmStake}
              disabled={!publicKey}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-4 rounded-2xl font-black text-lg transition-all cursor-pointer"
            >
              {publicKey ? "Confirm & Stake (Phantom)" : "Connect Wallet"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===============================
  // WAITING FOR BOTH
  // ===============================
  if (state === "waiting_both") {
    return (
      <div className="min-h-screen bg-white text-slate-900 font-sans p-4 md:p-8 lg:p-12 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>

        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-slate-400 hover:text-black font-bold transition-all mb-8 group cursor-pointer"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </button>

          <div className="mb-12">
            <h1 className="text-4xl font-black tracking-tight mb-2">⚔️ Ready to Duel</h1>
            <p className="text-slate-600">Both stakes confirmed. Start the match whenever you're ready.</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-3xl p-8 mb-8">
            <div className="flex items-center justify-center gap-4 mb-8">
              <CheckCircle2 size={32} className="text-emerald-600" />
              <span className="text-2xl font-black text-emerald-600">Your Deposit Confirmed</span>
            </div>

            {opponentDeposited && (
              <div className="flex items-center justify-center gap-4 mb-8">
                <CheckCircle2 size={32} className="text-emerald-600" />
                <span className="text-2xl font-black text-emerald-600">Opponent Deposit Confirmed</span>
              </div>
            )}

            {!opponentDeposited && (
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin"></div>
                <span className="text-xl font-bold text-slate-600">Waiting for opponent...</span>
              </div>
            )}

            <button
              onClick={handleStartDuel}
              disabled={!opponentDeposited}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-4 rounded-2xl font-black text-lg transition-all cursor-pointer"
            >
              {opponentDeposited ? "🎮 Start Duel" : "Waiting for Opponent..."}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===============================
  // GAME IN PROGRESS
  // ===============================
  if (state === "game" && puzzle) {
    return (
      <div className="min-h-screen bg-white text-slate-900 font-sans p-4 md:p-8 lg:p-12 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT SIDEBAR */}
          <div className="lg:col-span-3 space-y-6">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 text-slate-400 hover:text-black font-bold transition-all group cursor-pointer"
            >
              <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              Back
            </button>

            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-3.5 h-3.5 rounded-full animate-pulse ${
                  currentTurn === "White"
                    ? "bg-slate-200 border border-slate-300"
                    : "bg-black shadow-lg shadow-black/20"
                }`} />
                <span className="text-xs font-black uppercase tracking-[0.15em] italic">
                  {currentTurn} to move
                </span>
              </div>
              <div className="text-xs font-black uppercase tracking-widest text-slate-600 mb-4">Your Progress</div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">Solved</span>
                  <span className="text-lg font-black text-emerald-600">{puzzlesSolved}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">Failed</span>
                  <span className="text-lg font-black text-red-600">{puzzlesFailed}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-300">
                  <span className="text-sm font-bold text-slate-700">Lives</span>
                  <div className="flex gap-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-4 h-4 rounded-full ${
                          i < playerLives
                            ? 'bg-emerald-500'
                            : 'bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl p-6">
              <div className="text-xs font-black uppercase tracking-widest text-slate-600 mb-4">Opponent</div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">Solved</span>
                  <span className="text-lg font-black">{opponentPuzzlesSolved}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">Failed</span>
                  <span className="text-lg font-black">{opponentPuzzlesFailed}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-300">
                  <span className="text-sm font-bold text-slate-700">Lives</span>
                  <div className="flex gap-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-4 h-4 rounded-full ${
                          i < opponentLives
                            ? 'bg-emerald-500'
                            : 'bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 text-center">
              <Timer size={24} className="mx-auto mb-2 text-yellow-600" />
              <div className="text-xs font-black uppercase tracking-widest text-yellow-700 mb-2">Time Remaining</div>
              <div className="text-3xl font-black text-yellow-600">{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}</div>
            </div>
          </div>

          {/* CENTER BOARD */}
          <div className="lg:col-span-6 relative">
            {!loading && position && (
              <div className="w-full max-w-[500px] mx-auto rounded-2xl overflow-hidden border-[12px] border-slate-50 shadow-inner relative">
                <div className={playerLives === 0 ? "blur-sm" : ""}>
                  <Chessboard
                    boardOrientation={playerColor}
                    options={{
                      position,
                      onSquareClick,
                      onPieceDrop,
                      squareStyles: { ...lastMoveSquares, ...optionSquares },
                      id: "duel-board",
                      arePiecesDraggable: (piece) => {
                        if (!playerColor || playerLives === 0) return false;
                        return playerColor === 'white' ? piece.color === 'w' : piece.color === 'b';
                      },
                    }}
                  />
                </div>
                {playerLives === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                    <div className="text-center">
                      <p className="text-white font-black text-2xl">Waiting for opponent</p>
                      <p className="text-white/80 text-sm mt-2">to finish their game</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===============================
  // GAME ENDED
  // ===============================
  if (state === "ended" && result) {
    const isWinner = playerRole === "player_a" ? result.winnerId === user?.id : result.winnerId === user?.id;
    const isDraw = result.isDraw;
    const headline = isDraw ? "Draw" : isWinner ? "Victory!" : "Defeat";
    const headlineColor = isDraw ? "text-slate-400" : isWinner ? "text-emerald-600" : "text-red-500";

    return (
      <div className="min-h-screen bg-white text-slate-900 font-sans p-4 md:p-8 lg:p-12 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>

        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-slate-400 hover:text-black font-bold transition-all mb-8 group cursor-pointer"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </button>

          <div className={`bg-gradient-to-br ${isDraw ? "from-slate-900 to-slate-800" : isWinner ? "from-emerald-900 to-emerald-800" : "from-red-900 to-red-800"} rounded-[3rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl`}>
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-2">Match Complete</p>
              <h2 className={`text-4xl md:text-5xl font-black italic tracking-tighter mb-2 ${headlineColor}`}>{headline}</h2>
              <p className="text-slate-300 text-sm mb-8">
                {result.playerASolved} vs {result.playerBSolved} puzzles solved
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 mt-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-3">Your Stats</div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Solved</span>
                      <span className="font-bold text-emerald-400">{result.playerASolved}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Failed</span>
                      <span className="font-bold text-red-400">{puzzlesFailed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Lives Used</span>
                      <span className="font-bold">{3 - playerLives}/3</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-3">Opponent</div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Solved</span>
                      <span className="font-bold text-emerald-400">{result.playerBSolved}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Failed</span>
                      <span className="font-bold text-red-400">{opponentPuzzlesFailed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Lives Used</span>
                      <span className="font-bold">{3 - opponentLives}/3</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate("/dashboard")}
                className="w-full bg-emerald-400 text-black py-4 rounded-2xl font-black text-lg hover:bg-emerald-300 transition-all cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
