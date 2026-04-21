import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FaTrophy, FaUserGraduate, FaMedal } from "react-icons/fa";
import api from "./lib/api";
import AsyncState from "./components/AsyncState";

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/dashboard/leaderboard");
      setRows(Array.isArray(res.data?.leaderboard) ? res.data.leaderboard : []);
    } catch (e) {
      setError(e.response?.data?.message || "Could not load leaderboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="content-panel">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-badge">Leaderboard</span>
          <h1>See the most active campus participants.</h1>
          <p>Rankings are based on registrations, attendance, and long-term engagement.</p>
        </div>
        <div className="hero-stats">
          <div className="stat-card"><strong>{rows.length}</strong><span>Ranked users</span></div>
          <div className="stat-card"><strong>{rows[0]?.points || 0}</strong><span>Top points</span></div>
        </div>
      </section>

      {loading ? (
        <AsyncState variant="loading" title="Loading leaderboard" description="Calculating activity scores." />
      ) : error ? (
        <AsyncState variant="error" title="Could not load leaderboard" description={error} actionLabel="Retry" onAction={fetchData} />
      ) : rows.length === 0 ? (
        <AsyncState variant="empty" title="No rankings yet" description="The first active participants will appear here once events are underway." actionLabel="Refresh" onAction={fetchData} />
      ) : (
        <div className="stack-grid">
          {rows.map((row) => (
            <motion.article key={row.user?.id || row.rank} className="card-surface" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="section-head compact">
                <div>
                  <h2>#{row.rank} {row.user?.name || "Unknown"}</h2>
                  <p className="muted">{row.user?.department || "No department"} • {row.user?.year || "Year not set"}</p>
                </div>
                <div className="section-icon"><FaTrophy /></div>
              </div>
              <div className="mini-stats">
                <div className="mini-card"><FaUserGraduate /><strong>{row.registrations}</strong><span>Registrations</span></div>
                <div className="mini-card"><FaMedal /><strong>{row.checkedIn}</strong><span>Checked in</span></div>
                <div className="mini-card"><strong>{row.points}</strong><span>Points</span></div>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
