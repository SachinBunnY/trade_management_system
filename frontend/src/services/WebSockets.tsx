import { useEffect, useRef, useState } from "react";
import { hostIP } from "./util";

type CDCMessage = {
  lsn: string;
  xid: string;
  data: Record<string, string | number>;
  table_name: string;
  operation: string;
};


export default function useWebSocket(onMessage: (data: CDCMessage) => void,url: string = `ws://${hostIP}:8000/ws`) {
  const socketRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connected"|"disconnected"|"reconnecting">("disconnected");
  
  useEffect(() => {
    let isMounted = true;

    const connect = () => {
      setConnectionStatus("reconnecting");
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connected");
        setConnectionStatus("connected");
        heartbeatRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
            console.log("Sent heartbeat ping");
          }
        }, 30000);
      };

      socket.onmessage = (event) => {
        try {
          const jsonData: CDCMessage = JSON.parse(event.data);
          if (isMounted) onMessage(jsonData);
        } catch (err) {
          console.error("Failed to parse message:", err);
        }
      };

      socket.onclose = () => {
        console.warn("WebSocket closed. Reconnecting in 3s...");
        setConnectionStatus("reconnecting");
        clearInterval(heartbeatRef.current!);
        if (isMounted) {
          reconnectRef.current = setTimeout(connect, 3000);
        }
      };

      socket.onerror = (err) => {
        console.error("WebSocket error:", err);
        socket.close();
      };
    };

    connect();

    return () => {
      console.log(" Cleaning up WebSocket");
      isMounted = false;
      setConnectionStatus("disconnected");
      if (
        socketRef.current &&
        socketRef.current.readyState !== WebSocket.CLOSED &&
        socketRef.current.readyState !== WebSocket.CLOSING
      ) {
        socketRef.current.close();
      }
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [url, onMessage]);
  return connectionStatus;
}
