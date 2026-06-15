import React, { useState, useEffect, useRef } from "react";
import { X, Download, Link } from "lucide-react";

export default function AddDownloadModal({ onAdd, onClose }) {
  const [url, setUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [priority, setPriority] = useState("normal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) { setError("Please enter a URL"); return; }
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      setError("URL must start with http:// or https://");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onAdd(trimmed, filename.trim(), priority);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to add download");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000,
      backdropFilter: "blur(4px)",
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: 14,
        padding: "28px 32px",
        width: "100%",
        maxWidth: 480,
        boxShadow: "0 24px 64px rgba(0,0,0,.5)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Download size={20} color="#3b82f6" />
            <span style={{ fontWeight: 700, fontSize: 18 }}>New Download</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Download URL</label>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <Link size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
            <input
              ref={inputRef}
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/file.zip"
              style={{ ...inputStyle, paddingLeft: 34 }}
            />
          </div>

          <label style={labelStyle}>Filename <span style={{ color: "#64748b", fontWeight: 400 }}>(optional)</span></label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="Leave blank to auto-detect"
            style={{ ...inputStyle, marginBottom: 14 }}
          />

          <label style={labelStyle}>Priority</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
            {["high", "normal", "low"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                style={{
                  flex: 1, padding: "7px 0",
                  borderRadius: 7,
                  border: `1px solid ${priority === p ? "#3b82f6" : "#334155"}`,
                  background: priority === p ? "#1d4ed8" : "#0f172a",
                  color: priority === p ? "#fff" : "#94a3b8",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "all .15s",
                  textTransform: "capitalize",
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ color: "#f87171", fontSize: 12, marginBottom: 14, padding: "8px 12px", background: "#450a0a", borderRadius: 6 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: "10px 0",
              background: "#0f172a", border: "1px solid #334155",
              borderRadius: 8, color: "#94a3b8", fontSize: 14,
              cursor: "pointer", fontWeight: 600,
            }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{
              flex: 2, padding: "10px 0",
              background: loading ? "#1e40af" : "#3b82f6",
              border: "none", borderRadius: 8,
              color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background .15s",
            }}>
              {loading ? "Adding…" : "Start Download"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#94a3b8",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 7,
  color: "#f1f5f9",
  fontSize: 14,
  outline: "none",
  transition: "border-color .2s",
};
