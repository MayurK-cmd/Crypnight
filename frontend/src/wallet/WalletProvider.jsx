import { useMemo } from "react";
import { createContext, useContext, useState, useEffect } from "react";

const WalletContext = createContext();

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within FreighterProvider");
  }
  return context;
}

export default function FreighterProvider({ children }) {
  const [wallet, setWallet] = useState(null);
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState(null);

  useEffect(() => {
    const checkFreighter = async () => {
      if (window.freighter) {
        setWallet(window.freighter);
        try {
          const publicKey = await window.freighter.getPublicKey();
          setPublicKey(publicKey);
          setConnected(true);
        } catch (error) {
          console.log("Freighter not connected yet");
        }
      }
    };

    checkFreighter();
    window.addEventListener("freighter_ready", checkFreighter);
    return () => window.removeEventListener("freighter_ready", checkFreighter);
  }, []);

  const connect = async () => {
    if (!window.freighter) {
      throw new Error("Freighter wallet not installed");
    }
    try {
      const publicKey = await window.freighter.getPublicKey();
      setPublicKey(publicKey);
      setConnected(true);
      return publicKey;
    } catch (error) {
      console.error("Failed to connect Freighter:", error);
      throw error;
    }
  };

  const disconnect = () => {
    setPublicKey(null);
    setConnected(false);
  };

  const signTransaction = async (transactionXDR) => {
    if (!window.freighter) {
      throw new Error("Freighter wallet not installed");
    }
    return await window.freighter.signTransaction(transactionXDR, {
      networkPassphrase: "Test SDF Network ; September 2015"
    });
  };

  const value = {
    wallet,
    connected,
    publicKey,
    connect,
    disconnect,
    signTransaction
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}
