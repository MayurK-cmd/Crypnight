import { useEffect, useRef, useState } from 'react';

export function useDuelWebSocket() {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState(null);
  const messageCallbacks = useRef({});
  const cleanupRef = useRef([]);

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
    const protocol = backendUrl.startsWith('https') ? 'wss:' : 'ws:';
    const host = backendUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${protocol}//${host}/ws/duel`;

    console.log('Connecting to WebSocket at:', wsUrl);
    ws.current = new WebSocket(wsUrl);

    const handleOpen = () => {
      console.log('Connected to duel WebSocket');
      setConnected(true);
    };

    const handleMessage = (event) => {
      const data = JSON.parse(event.data);
      setMessage(data);

      if (messageCallbacks.current[data.type]) {
        messageCallbacks.current[data.type](data);
      }
    };

    const handleError = (error) => {
      console.error('WebSocket error:', error);
    };

    const handleClose = () => {
      console.log('Disconnected from duel WebSocket');
      setConnected(false);
    };

    ws.current.addEventListener('open', handleOpen);
    ws.current.addEventListener('message', handleMessage);
    ws.current.addEventListener('error', handleError);
    ws.current.addEventListener('close', handleClose);

    cleanupRef.current = [handleOpen, handleMessage, handleError, handleClose];

    return () => {
      if (ws.current) {
        const [hOpen, hMsg, hErr, hClose] = cleanupRef.current;
        ws.current.removeEventListener('open', hOpen);
        ws.current.removeEventListener('message', hMsg);
        ws.current.removeEventListener('error', hErr);
        ws.current.removeEventListener('close', hClose);
        ws.current.close();
      }
    };
  }, []);

  const send = (type, data = {}) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, ...data }));
    }
  };

  const onMessage = (type, callback) => {
    messageCallbacks.current[type] = callback;
  };

  return {
    connected,
    message,
    send,
    onMessage,
  };
}



