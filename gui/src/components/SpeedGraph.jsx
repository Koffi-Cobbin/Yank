import React, { useState, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function formatSpeed(bps) {
  if (!bps || bps === 0) return "0 KB/s";
  if (bps < 1024 ** 2) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1024 ** 2).toFixed(2)} MB/s`;
}

export default function SpeedGraph({ downloads }) {
  const [history, setHistory] = useState(
    Array.from({ length: 30 }, (_, i) => ({ t: i, speed: 0 }))
  );
  const tickRef = useRef(30);

  useEffect(() => {
    const totalSpeed = downloads
      .filter((d) => d.status === "downloading")
      .reduce((sum, d) => sum + (d.speed_bps || 0), 0);

    setHistory((prev) => {
      const next = [...prev.slice(-29), { t: tickRef.current++, speed: totalSpeed }];
      return next;
    });
  }, [downloads]);

  const currentSpeed = history[history.length - 1]?.speed || 0;
  const maxSpeed = Math.max(...history.map((h) => h.speed), 1);

  return (
    <div style={{
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: 12,
      padding: "16px 20px",
      marginBottom: 24,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em" }}>
          Download Speed
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#3b82f6" }}>
          {formatSpeed(currentSpeed)}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={history} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="t" hide />
          <YAxis domain={[0, maxSpeed * 1.2]} hide />
          <Tooltip
            formatter={(v) => [formatSpeed(v), "Speed"]}
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, fontSize: 12 }}
            labelFormatter={() => ""}
          />
          <Area
            type="monotone"
            dataKey="speed"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#speedGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
