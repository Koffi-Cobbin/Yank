import React, { useState } from "react";
import {
  Pause, Play, X, Trash2, Pencil, RotateCcw, Copy, Check, AlertCircle,
} from "lucide-react";

const STATUS_STYLES = {
  queued:      { bg: "#1e3a5f", text: "#60a5fa", label: "Queued" },
  downloading: { bg: "#14532d", text: "#4ade80", label: "Downloading" },
  paused:      { bg: "#3b2f00", text: "#fbbf24", label: "Paused" },
  complete:    { bg: "#14532d", text: "#86efac", label: "Complete" },
  failed:      { bg: "#450a0a", text: "#f87171", label: "Failed" },
  cancelled:   { bg: "#1c1c1c", text: "#9ca3af", label: "Cancelled" },
};

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatSpeed(bps) {
  if (!bps || bps === 0) return "";
  return `${formatBytes(bps)}/s`;
}

function formatEta(sec) {
  if (!sec || sec <= 0) return "";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function fileIcon(filename) {
  const ext = (filename || "").split(".").pop().toLowerCase();
  const map = {
    zip: "📦", tar: "📦", gz: "📦", rar: "📦", "7z": "📦",
    mp4: "🎬", mkv: "🎬", avi: "🎬", mov: "🎬", webm: "🎬",
    mp3: "🎵", flac: "🎵", wav: "🎵", aac: "🎵",
    pdf: "📄", doc: "📝", docx: "📝", xls: "📊", xlsx: "📊",
    png: "🖼️", jpg: "🖼️", jpeg: "🖼️", gif: "🖼️", svg: "🖼️", webp: "🖼️",
    exe: "⚙️", dmg: "⚙️", deb: "⚙️", rpm: "⚙️",
    iso: "💿",
  };
  return map[ext] || "📁";
}

export default function DownloadItem({
  download,
  onPause, onResume, onCancel, onDelete, onEdit, onRetry,
}) {
  const {
    id, url, filename, status, progress,
    speed_bps, eta_seconds, total_bytes, downloaded_bytes, priority,
  } = download;

  const style = STATUS_STYLES[status] || STATUS_STYLES.queued;
  const isActive    = status === "downloading";
  const isPaused    = status === "paused";
  const isDone      = status === "complete";
  const isFailed    = status === "failed";
  const isCancelled = status === "cancelled";
  const isQueued    = status === "queued";
  const isEditable  = isQueued || isPaused;
  const isRetryable = isFailed || isCancelled;
  const isStopped   = isDone || isFailed || isCancelled;

  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pct = Math.min(100, Math.max(0, progress || 0));

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const PRIORITY_COLOR = { high: "#f87171", normal: "#94a3b8", low: "#64748b" };

  return (
    <div style={{
      background: "#1e293b",
      borderRadius: 10,
      padding: "14px 16px",
      marginBottom: 10,
      border: `1px solid ${confirmDelete ? "#ef444460" : "#334155"}`,
      transition: "border-color .2s",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>
          {fileIcon(filename)}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top row: name + badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{
              fontWeight: 600, fontSize: 14, color: "#f1f5f9",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flex: 1, minWidth: 0,
            }}>
              {filename || url.split("/").pop() || "download"}
            </span>

            {priority && priority !== "normal" && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 6px",
                borderRadius: 20, border: `1px solid ${PRIORITY_COLOR[priority]}40`,
                color: PRIORITY_COLOR[priority], textTransform: "uppercase",
                letterSpacing: ".04em", flexShrink: 0,
              }}>
                {priority}
              </span>
            )}

            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px",
              borderRadius: 20, background: style.bg, color: style.text,
              flexShrink: 0,
            }}>
              {style.label}
            </span>
          </div>

          {/* URL */}
          <div style={{
            fontSize: 11, color: "#64748b", marginBottom: 8,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {url}
          </div>

          {/* Progress bar */}
          <div style={{ height: 8, background: "#334155", borderRadius: 4, marginBottom: 6, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${pct}%`,
              background: isActive  ? "linear-gradient(90deg, #3b82f6, #60a5fa)"
                        : isDone    ? "#22c55e"
                        : isPaused  ? "#f59e0b"
                        : isFailed  ? "#ef4444"
                        : "#3b82f6",
              borderRadius: 4,
              transition: "width .5s ease",
            }} />
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "#94a3b8" }}>
            <span>
              {formatBytes(downloaded_bytes)} / {formatBytes(total_bytes)}
              {isActive && speed_bps > 0 && (
                <span style={{ color: "#4ade80", marginLeft: 8 }}>{formatSpeed(speed_bps)}</span>
              )}
              {isActive && eta_seconds > 0 && (
                <span style={{ marginLeft: 8 }}>ETA {formatEta(eta_seconds)}</span>
              )}
            </span>
            <span style={{ fontWeight: 600 }}>{pct.toFixed(0)}%</span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "flex-start" }}>
          {/* Copy URL */}
          <button onClick={handleCopy} title="Copy URL" style={btnStyle(copied ? "#064e3b" : "#1e293b", copied ? "#34d399" : "#64748b")}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>

          {/* Edit — queued or paused only */}
          {isEditable && (
            <button onClick={() => onEdit(download)} title="Edit" style={btnStyle("#1e293b", "#a78bfa")}>
              <Pencil size={13} />
            </button>
          )}

          {/* Pause — active only */}
          {isActive && (
            <button onClick={() => onPause(id)} title="Pause" style={btnStyle("#1e293b", "#f59e0b")}>
              <Pause size={13} />
            </button>
          )}

          {/* Resume — paused only */}
          {isPaused && (
            <button onClick={() => onResume(id)} title="Resume" style={btnStyle("#1e293b", "#3b82f6")}>
              <Play size={13} />
            </button>
          )}

          {/* Retry — failed or cancelled */}
          {isRetryable && (
            <button onClick={() => onRetry(id)} title="Retry" style={btnStyle("#1e293b", "#3b82f6")}>
              <RotateCcw size={13} />
            </button>
          )}

          {/* Cancel — active, queued, paused */}
          {!isStopped && (
            <button onClick={() => onCancel(id)} title="Cancel" style={btnStyle("#1e293b", "#f59e0b")}>
              <X size={13} />
            </button>
          )}

          {/* Delete — remove from list entirely */}
          <button
            onClick={handleDelete}
            title={confirmDelete ? "Click again to confirm" : "Delete"}
            style={btnStyle(confirmDelete ? "#450a0a" : "#1e293b", "#ef4444")}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Error message */}
      {isFailed && download.error && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#f87171", display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={12} /> {download.error}
        </div>
      )}

      {/* Delete confirmation hint */}
      {confirmDelete && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#fca5a5", textAlign: "right" }}>
          Click 🗑 again to confirm deletion
        </div>
      )}
    </div>
  );
}

function btnStyle(bg, color) {
  return {
    width: 28, height: 28,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: bg,
    border: `1px solid ${color}44`,
    borderRadius: 6,
    color,
    cursor: "pointer",
    padding: 0,
    transition: "background .15s, border-color .15s",
  };
}
