import { useEffect, useRef, useCallback } from 'react';

export function useDuelSocket() {
  const socketRef = useRef(null);
  const listenersRef = useRef({
    matchFound: [],
    duelStart: [],
    newPuzzle: [],
    puzzleSolved: [],
    puzzleFailed: [],
    opponentReply: [],
    duelEnded: [],
  });

  // Connect to WebSocket
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
    const protocol = backendUrl.startsWith('https') ? 'wss:' : 'ws:';
    const host = backendUrl.replace(/^https?:\/\//, '');
    const url = `${protocol}//${host}/ws/duel`;

    const ws = new WebSocket(url);

    ws.onopen = () => {
      socketRef.current = ws;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Dispatch to appropriate listeners
        if (data.type === 'match:found') {
          listenersRef.current.matchFound.forEach(cb => cb(data));
        } else if (data.type === 'both:deposited') {
          listenersRef.current.opponentReply.forEach(cb => cb(data));
        } else if (data.type === 'opponent:deposited') {
          listenersRef.current.opponentReply.forEach(cb => cb(data));
        } else if (data.type === 'duel:start') {
          listenersRef.current.duelStart.forEach(cb => cb(data));
        } else if (data.type === 'duel:new_puzzle') {
          listenersRef.current.newPuzzle.forEach(cb => cb(data));
        } else if (data.type === 'puzzle:Solved') {
          listenersRef.current.puzzleSolved.forEach(cb => cb(data));
        } else if (data.type === 'puzzle:failed') {
          listenersRef.current.puzzleFailed.forEach(cb => cb(data));
        } else if (data.type === 'opponent:Solved_puzzle' || data.type === 'opponent:failed_puzzle' || data.type === 'opponent:moved') {
          listenersRef.current.opponentReply.forEach(cb => cb(data));
        } else if (data.type === 'duel:ended') {
          listenersRef.current.duelEnded.forEach(cb => cb(data));
        } else if (data.type === 'error') {
        }
      } catch (err) {
      }
    };

    ws.onerror = (error) => {
    };

    ws.onclose = () => {
      socketRef.current = null;
    };

    return () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    };
  }, []);

  const send = useCallback((type, data) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    socketRef.current.send(JSON.stringify({ type, ...data }));
  }, []);

  const joinQueue = useCallback((tier) => {
    send('queue:join', { tier });
  }, [send]);

  const confirmDeposit = useCallback((matchId, txSignature) => {
    send('deposit:confirm', { matchId, txSignature });
  }, [send]);

  const startDuel = useCallback((matchId) => {
    send('duel:start', { matchId });
  }, [send]);

  const submitMove = useCallback((matchId, move) => {
    send('move:submit', { matchId, move });
  }, [send]);

  const onMatchFound = useCallback((callback) => {
    listenersRef.current.matchFound.push(callback);
    return () => {
      listenersRef.current.matchFound = listenersRef.current.matchFound.filter(cb => cb !== callback);
    };
  }, []);

  const onDuelStart = useCallback((callback) => {
    listenersRef.current.duelStart.push(callback);
    return () => {
      listenersRef.current.duelStart = listenersRef.current.duelStart.filter(cb => cb !== callback);
    };
  }, []);

  const onNewPuzzle = useCallback((callback) => {
    listenersRef.current.newPuzzle.push(callback);
    return () => {
      listenersRef.current.newPuzzle = listenersRef.current.newPuzzle.filter(cb => cb !== callback);
    };
  }, []);

  const onPuzzleSolved = useCallback((callback) => {
    listenersRef.current.puzzleSolved.push(callback);
    return () => {
      listenersRef.current.puzzleSolved = listenersRef.current.puzzleSolved.filter(cb => cb !== callback);
    };
  }, []);

  const onPuzzleFailed = useCallback((callback) => {
    listenersRef.current.puzzleFailed.push(callback);
    return () => {
      listenersRef.current.puzzleFailed = listenersRef.current.puzzleFailed.filter(cb => cb !== callback);
    };
  }, []);

  const onOpponentReply = useCallback((callback) => {
    listenersRef.current.opponentReply.push(callback);
    return () => {
      listenersRef.current.opponentReply = listenersRef.current.opponentReply.filter(cb => cb !== callback);
    };
  }, []);

  const onDuelEnded = useCallback((callback) => {
    listenersRef.current.duelEnded.push(callback);
    return () => {
      listenersRef.current.duelEnded = listenersRef.current.duelEnded.filter(cb => cb !== callback);
    };
  }, []);

  return {
    socket: socketRef.current,
    send,
    joinQueue,
    confirmDeposit,
    startDuel,
    submitMove,
    onMatchFound,
    onDuelStart,
    onNewPuzzle,
    onPuzzleSolved,
    onPuzzleFailed,
    onOpponentReply,
    onDuelEnded,
  };
}



