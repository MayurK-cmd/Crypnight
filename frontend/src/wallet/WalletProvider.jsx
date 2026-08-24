import { useMemo } from "react";
import { createContext, useContext, useState, useEffect } from "react";
import {
  isConnected as freighterIsConnected,
  getAddress,
  setAllowed,
  signTransaction as freighterSignTransaction,
  signMessage as freighterSignMessage,
} from "@stellar/freighter-api";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initFreighter = async () => {
      try {
        console.log("🔍 Checking Freighter connection...");

        // Check if Freighter is connected
        const isConn = await freighterIsConnected();
        console.log("✅ Freighter API available");

        if (isConn) {
          const addr = await getAddress();
          setPublicKey(addr);
          setConnected(true);
          setWallet(true);
          console.log("✅ Freighter connected, wallet:", addr);
        } else {
          console.log("⚠️ Freighter available but not connected yet");
          setWallet(true);
        }
      } catch (err) {
        console.error("❌ Freighter not available:", err.message);
        setError("Freighter wallet not found. Please install the extension from https://freighter.app");
      } finally {
        setLoading(false);
      }
    };

    initFreighter();
  }, []);

  const connect = async () => {
    try {
      console.log("🔗 Attempting to connect Freighter wallet...");

      await setAllowed();
      const address = await getAddress();

      setPublicKey(address);
      setConnected(true);
      setWallet(true);
      setError(null);

      console.log("✅ Connected to wallet:", address);
      return address;
    } catch (error) {
      console.error("Failed to connect Freighter:", error);
      setError(error.message || "Failed to connect wallet");
      throw error;
    }
  };

  const disconnect = () => {
    setPublicKey(null);
    setConnected(false);
    console.log("🔓 Disconnected from wallet");
  };

  const signTransaction = async (transactionXDR) => {
    if (!wallet) {
      throw new Error("Freighter wallet not available");
    }

    return await freighterSignTransaction(transactionXDR, {
      networkPassphrase: "Test SDF Network ; September 2015"
    });
  };

  const signMessage = async (message) => {
    if (!wallet) {
      throw new Error("Freighter wallet not available");
    }

    // freighterSignMessage expects just the message string
    return await freighterSignMessage(message);
  };

  const value = {
    wallet,
    connected,
    publicKey,
    connect,
    disconnect,
    signTransaction,
    signMessage,
    loading,
    error,
    isConnected: freighterIsConnected,
    getAddress
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}
