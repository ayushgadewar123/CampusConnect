import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FaHistory } from "react-icons/fa";
import api from "./lib/api";
import AsyncState from "./components/AsyncState";

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBA";
  return date.toLocaleString();
}

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/admin/logs");
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setError(error.response?.data?.message || "Could not load audit logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="content-panel">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-badge">Audit logs</span>
          <h1>Track every important admin action.</h1>
          <p>Monitor edits, check-ins, registrations, and role changes from one timeline.</p>
        </div>
        <div className="hero-stats">
          <div className="stat-card"><strong>{logs.length}</strong><span>Recent actions</span></div>
        </div>
      </section>

      {loading ? (
        <AsyncState variant="loading" title="Loading audit logs" description="Fetching the latest admin activity." />
      ) : error ? (
        <AsyncState variant="error" title="Could not load audit logs" description={error} actionLabel="Retry" onAction={fetchData} />
      ) : logs.length === 0 ? (
        <AsyncState variant="empty" title="No audit logs yet" description="Important admin events will appear here automatically." actionLabel="Refresh" onAction={fetchData} />
      ) : (
        <div className="timeline-list">
          {logs.map((log) => (
            <motion.article key={log._id} className="notification-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="notification-icon"><FaHistory /></div>
              <div>
                <h3>{log.action}</h3>
                <p>{log.title || log.entityType} • {log.actorName || log.actor?.name || "System"} • {formatDate(log.createdAt)}</p>
                <p className="muted">{log.entityType}{log.entityId ? ` #${String(log.entityId).slice(-6)}` : ""}</p>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
