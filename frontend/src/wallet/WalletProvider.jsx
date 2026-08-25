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

// @stellar/freighter-api v6 returns objects, not raw values:
//   isConnected() -> { isConnected: boolean }
//   getAddress()   -> { address: string }
// Unwrap defensively so consumers always get a plain string / boolean.
const unwrapIsConnected = (res) => {
  if (res && typeof res === "object") return Boolean(res.isConnected);
  return Boolean(res);
};

const unwrapAddress = (res) => {
  if (res && typeof res === "object") return res.address ?? null;
  return typeof res === "string" ? res : null;
};

export default function FreighterProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initFreighter = async () => {
      try {
        console.log("🔍 Checking Freighter connection...");

        const isConn = unwrapIsConnected(await freighterIsConnected());
        console.log("✅ Freighter API available");

        if (isConn) {
          const addr = unwrapAddress(await getAddress());
          setPublicKey(addr);
          setConnected(Boolean(addr));
          console.log("✅ Freighter connected, wallet:", addr);
        } else {
          console.log("⚠️ Freighter available but not connected yet");
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
      const address = unwrapAddress(await getAddress());

      setPublicKey(address);
      setConnected(Boolean(address));
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
    return await freighterSignTransaction(transactionXDR, {
      networkPassphrase: "Test SDF Network ; September 2015",
    });
  };

  const signMessage = async (message) => {
    return await freighterSignMessage(message);
  };

  const value = {
    connected,
    publicKey,
    connect,
    disconnect,
    signTransaction,
    signMessage,
    loading,
    error,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}
