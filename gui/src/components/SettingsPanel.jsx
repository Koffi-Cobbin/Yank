import React, { useState } from "react";
import { Settings, X, Save } from "lucide-react";

export default function SettingsPanel({ config, onSave, onClose }) {
  const [form, setForm] = useState({
    default_download_dir: config?.default_download_dir || "~/Downloads",
    max_connections_per_file: config?.max_connections_per_file ?? 16,
    max_concurrent_downloads: config?.max_concurrent_downloads ?? 3,
    speed_limit_kbps: config?.speed_limit_kbps ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
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
        width: "100%", maxWidth: 440,
        boxShadow: "0 24px 64px rgba(0,0,0,.5)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Settings size={20} color="#3b82f6" />
            <span style={{ fontWeight: 700, fontSize: 18 }}>Settings</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={labelStyle}>Default Download Folder</label>
            <input
              value={form.default_download_dir}
              onChange={(e) => update("default_download_dir", e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Max Connections per File ({form.max_connections_per_file})</label>
            <input type="range" min={1} max={32}
              value={form.max_connections_per_file}
              onChange={(e) => update("max_connections_per_file", Number(e.target.value))}
              style={{ width: "100%", accentColor: "#3b82f6" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b" }}>
              <span>1</span><span>32</span>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Max Simultaneous Downloads ({form.max_concurrent_downloads})</label>
            <input type="range" min={1} max={10}
              value={form.max_concurrent_downloads}
              onChange={(e) => update("max_concurrent_downloads", Number(e.target.value))}
              style={{ width: "100%", accentColor: "#3b82f6" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b" }}>
              <span>1</span><span>10</span>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Speed Limit (KB/s — 0 = unlimited)</label>
            <input
              type="number" min={0}
              value={form.speed_limit_kbps}
              onChange={(e) => update("speed_limit_kbps", Number(e.target.value))}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0",
            background: "#0f172a", border: "1px solid #334155",
            borderRadius: 8, color: "#94a3b8", fontSize: 14,
            cursor: "pointer", fontWeight: 600,
          }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 2, padding: "10px 0",
            background: saved ? "#059669" : "#3b82f6",
            border: "none", borderRadius: 8,
            color: "#fff", fontSize: 14, fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            transition: "background .2s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <Save size={14} />
            {saved ? "Saved!" : saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
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
