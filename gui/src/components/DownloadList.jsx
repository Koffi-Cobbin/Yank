import React from "react";
import DownloadItem from "./DownloadItem.jsx";
import { Download, Inbox } from "lucide-react";

const FILTERS = ["all", "downloading", "queued", "paused", "complete", "failed"];

export default function DownloadList({ downloads, filter, onFilterChange, onPause, onResume, onCancel, onDelete, onEdit, onRetry }) {
  const filtered = downloads.filter((d) => {
    if (filter === "all") return true;
    return d.status === filter;
  });

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === "all" ? downloads.length : downloads.filter((d) => d.status === f).length;
    return acc;
  }, {});

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              border: `1px solid ${filter === f ? "#3b82f6" : "#334155"}`,
              background: filter === f ? "#1d4ed8" : "#1e293b",
              color: filter === f ? "#fff" : "#94a3b8",
              fontSize: 12, fontWeight: 600,
              cursor: "pointer",
              transition: "all .15s",
              textTransform: "capitalize",
              display: "flex", alignItems: "center", gap: 5,
            }}
          >
            {f}
            {counts[f] > 0 && (
              <span style={{
                background: filter === f ? "rgba(255,255,255,.25)" : "#334155",
                borderRadius: 10, padding: "0 5px",
                fontSize: 10,
              }}>
                {counts[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Download items */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "60px 20px",
          color: "#475569",
        }}>
          <Inbox size={48} style={{ marginBottom: 12, opacity: .5 }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No downloads</div>
          <div style={{ fontSize: 13 }}>
            {filter === "all"
              ? "Click \"+ New Download\" to get started."
              : `No ${filter} downloads.`}
          </div>
        </div>
      ) : (
        filtered.map((d) => (
          <DownloadItem
            key={d.id}
            download={d}
            onPause={onPause}
            onResume={onResume}
            onCancel={onCancel}
            onDelete={onDelete}
            onEdit={onEdit}
            onRetry={onRetry}
          />
        ))
      )}
    </div>
  );
}
