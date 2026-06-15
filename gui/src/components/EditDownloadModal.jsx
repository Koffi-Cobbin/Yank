import React, { useState, useEffect, useRef } from "react";
import { X, Pencil } from "lucide-react";

export default function EditDownloadModal({ download, onSave, onClose }) {
  const [filename, setFilename] = useState(download.filename || "");
  const [priority, setPriority] = useState(download.priority || "normal");
  const [saving, setSaving] = useState(false);
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
    if (!filename.trim()) { setError("Filename cannot be empty"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(download.id, { filename: filename.trim(), priority });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, backdropFilter: "blur(4px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#1e293b", border: "1px solid #334155",
        borderRadius: 14, padding: "28px 32px",
        width: "100%", maxWidth: 420,
        boxShadow: "0 24px 64px rgba(0,0,0,.5)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Pencil size={18} color="#3b82f6" />
            <span style={{ fontWeight: 700, fontSize: 17 }}>Edit Download</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{
          fontSize: 11, color: "#64748b", marginBottom: 18,
          padding: "8px 10px", background: "#0f172a",
          borderRadius: 6, wordBreak: "break-all",
        }}>
          {download.url}
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Filename</label>
          <input
            ref={inputRef}
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            style={{ ...inputStyle, marginBottom: 16 }}
          />

          <label style={labelStyle}>Priority</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
            {["high", "normal", "low"].map((p) => (
              <button
                key={p} type="button"
                onClick={() => setPriority(p)}
                style={{
                  flex: 1, padding: "7px 0",
                  borderRadius: 7,
                  border: `1px solid ${priority === p ? "#3b82f6" : "#334155"}`,
                  background: priority === p ? "#1d4ed8" : "#0f172a",
                  color: priority === p ? "#fff" : "#94a3b8",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "all .15s", textTransform: "capitalize",
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
            <button type="submit" disabled={saving} style={{
              flex: 2, padding: "10px 0",
              background: "#3b82f6", border: "none",
              borderRadius: 8, color: "#fff",
              fontSize: 14, fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
            }}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 600,
  color: "#94a3b8", marginBottom: 6,
  textTransform: "uppercase", letterSpacing: ".05em",
};
const inputStyle = {
  width: "100%", padding: "9px 12px",
  background: "#0f172a", border: "1px solid #334155",
  borderRadius: 7, color: "#f1f5f9", fontSize: 14, outline: "none",
};
