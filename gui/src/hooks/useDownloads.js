import { useState, useEffect, useCallback } from "react";

const API_BASE = "/api";

export function useDownloads(pollIntervalMs = 1000) {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);

  const fetchDownloads = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/downloads`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDownloads(data.downloads || []);
      setBackendOnline(true);
      setError(null);
    } catch (e) {
      setBackendOnline(false);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDownloads();
    const id = setInterval(fetchDownloads, pollIntervalMs);
    return () => clearInterval(id);
  }, [fetchDownloads, pollIntervalMs]);

  const addDownload = useCallback(async (url, filename = "", priority = "normal") => {
    const res = await fetch(`${API_BASE}/downloads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, filename, priority }),
    });
    if (!res.ok) throw new Error(`Failed to add download: HTTP ${res.status}`);
    const data = await res.json();
    await fetchDownloads();
    return data;
  }, [fetchDownloads]);

  const pauseDownload = useCallback(async (id) => {
    await fetch(`${API_BASE}/downloads/${id}/pause`, { method: "POST" });
    await fetchDownloads();
  }, [fetchDownloads]);

  const resumeDownload = useCallback(async (id) => {
    await fetch(`${API_BASE}/downloads/${id}/resume`, { method: "POST" });
    await fetchDownloads();
  }, [fetchDownloads]);

  const cancelDownload = useCallback(async (id) => {
    await fetch(`${API_BASE}/downloads/${id}`, { method: "DELETE" });
    await fetchDownloads();
  }, [fetchDownloads]);

  return {
    downloads,
    loading,
    error,
    backendOnline,
    addDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    refresh: fetchDownloads,
  };
}
