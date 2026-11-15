import React, { useEffect, useRef, useState } from "react";
import { smartFetchJson } from "../engine/localApi";

export default function AssistantModal({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  if (!open) return null;

  const handleSendChat = async (e) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loadingChat) return;
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setInput("");
    setLoadingChat(true);
    try {
      const res = await smartFetchJson("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: q }),
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.respuesta || "No response.",
          origen: res.origen || "Offline System",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error querying autonomous medical backup.",
          origen: "Error",
        },
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(2, 6, 23, 0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="white-panel"
        style={{
          width: "100%",
          maxWidth: "600px",
          padding: "22px",
          borderRadius: "22px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0F172A" }}>
              Autonomous Clinical Assistant
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#64748B" }}>
              Onboard offline clinical guidance
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button type="button" className="pill-btn sm" onClick={() => setMessages([])}>
              Clear
            </button>
            <button
              type="button"
              className="pill-btn sm dark"
              onClick={onClose}
              aria-label="Close Assistant"
            >
              ✕
            </button>
          </div>
        </div>

        <div
          style={{
            height: "280px",
            overflowY: "auto",
            background: "#FAF7F2",
            border: "1px solid #DFD8CA",
            borderRadius: "14px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {messages.length === 0 && (
            <div style={{ fontSize: "12.5px", color: "#64748B" }}>
              Ask about current physiological status, active alerts, or emergency steps.
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "90%",
                padding: "9px 12px",
                borderRadius: "12px",
                fontSize: "12.5px",
                background: msg.role === "user" ? "#0F172A" : "#FFFFFF",
                color: msg.role === "user" ? "#FFFFFF" : "#0F172A",
                border: msg.role === "user" ? "none" : "1px solid #DFD8CA",
              }}
            >
              <div>{msg.content}</div>
              {msg.origen && (
                <div className="mono" style={{ fontSize: "10px", color: "#64748B", marginTop: "4px" }}>
                  Source: {msg.origen}
                </div>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSendChat} style={{ display: "flex", gap: "8px" }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g., Which protocol applies to chest pain or hypoxia?"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: "12px",
              border: "1px solid #D6CFC2",
              background: "#FAF7F2",
              fontSize: "12.5px",
              outline: "none",
            }}
          />
          <button type="submit" className="pill-btn dark" disabled={loadingChat}>
            {loadingChat ? "..." : "Ask"}
          </button>
        </form>
      </div>
    </div>
  );
}

