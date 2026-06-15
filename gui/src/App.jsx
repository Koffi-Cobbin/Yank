import React, { useState, useEffect, useCallback } from "react";
import { useDownloads } from "./hooks/useDownloads.js";
import DownloadList from "./components/DownloadList.jsx";
import AddDownloadModal from "./components/AddDownloadModal.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import SpeedGraph from "./components/SpeedGraph.jsx";
import { Plus, Settings, RefreshCw, Wifi, WifiOff, Download } from "lucide-react";

export default function App() {
  const {
    downloads, loading, error, backendOnline,
    addDownload, pauseDownload, resumeDownload, cancelDownload, refresh,
  } = useDownloads(1000);

  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState("all");
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setConfig(d))
      .catch(() => {});
  }, []);

  const saveConfig = async (updates) => {
    const res = await fetch("/api/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setConfig(updated);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (url && url.startsWith("http")) {
      setShowAdd(true);
    }
  }, []);

  const activeCount = downloads.filter((d) => d.status === "downloading").length;
  const totalSpeed = downloads
    .filter((d) => d.status === "downloading")
    .reduce((s, d) => s + (d.speed_bps || 0), 0);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9" }}
    >
      {/* Header */}
      <header style={{
        background: "#1e293b",
        borderBottom: "1px solid #334155",
        padding: "0 24px",
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 34, height: 34,
            background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Download size={18} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-.02em" }}>Yank</span>
          <span style={{ fontSize: 11, color: "#64748b", marginLeft: 4 }}>v0.1.0</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Connection status */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
            {backendOnline
              ? <><Wifi size={14} color="#22c55e" /><span style={{ color: "#22c55e" }}>API online</span></>
              : <><WifiOff size={14} color="#ef4444" /><span style={{ color: "#ef4444" }}>API offline</span></>
            }
          </div>

          <button onClick={refresh} style={iconBtnStyle} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button onClick={() => setShowSettings(true)} style={iconBtnStyle} title="Settings">
            <Settings size={15} />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 16px",
              background: "#3b82f6", border: "none",
              borderRadius: 8, color: "#fff",
              fontSize: 14, fontWeight: 700,
              cursor: "pointer",
              transition: "background .15s",
            }}
          >
            <Plus size={15} /> New Download
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>
        {/* Stats bar */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12, marginBottom: 24,
        }}>
          {[
            { label: "Total", value: downloads.length, color: "#94a3b8" },
            { label: "Downloading", value: activeCount, color: "#22c55e" },
            { label: "Complete", value: downloads.filter((d) => d.status === "complete").length, color: "#60a5fa" },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: "#1e293b", border: "1px solid #334155",
              borderRadius: 10, padding: "14px 18px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Speed graph */}
        <SpeedGraph downloads={downloads} />

        {/* Error notice */}
        {!backendOnline && (
          <div style={{
            background: "#450a0a", border: "1px solid #ef444440",
            borderRadius: 10, padding: "12px 16px", marginBottom: 20,
            fontSize: 13, color: "#fca5a5", display: "flex", alignItems: "center", gap: 8,
          }}>
            <WifiOff size={16} />
            <span>
              <strong>Backend offline.</strong> Start the Python orchestrator with{" "}
              <code style={{ background: "#7f1d1d", padding: "1px 5px", borderRadius: 3 }}>
                cd orchestrator && python main.py
              </code>{" "}
              to enable real downloads.
            </span>
          </div>
        )}

        {/* Downloads list */}
        <DownloadList
          downloads={downloads}
          filter={filter}
          onFilterChange={setFilter}
          onPause={pauseDownload}
          onResume={resumeDownload}
          onCancel={cancelDownload}
        />
      </main>

      {showAdd && (
        <AddDownloadModal
          onAdd={addDownload}
          onClose={() => setShowAdd(false)}
        />
      )}

      {showSettings && (
        <SettingsPanel
          config={config}
          onSave={saveConfig}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

const iconBtnStyle = {
  width: 34, height: 34,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "#0f172a", border: "1px solid #334155",
  borderRadius: 7, color: "#94a3b8",
  cursor: "pointer",
};
