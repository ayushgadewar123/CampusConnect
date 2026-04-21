import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FaMedal, FaStar, FaCheckCircle, FaHourglassHalf, FaChartLine } from "react-icons/fa";
import api from "./lib/api";
import AsyncState from "./components/AsyncState";

export default function Achievements() {
  const [data, setData] = useState({ badges: [], points: 0, stats: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/dashboard/achievements");
      setData({ badges: Array.isArray(res.data?.badges) ? res.data.badges : [], points: res.data?.points || 0, stats: res.data?.stats || {} });
    } catch (e) {
      setError(e.response?.data?.message || "Could not load achievements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const progress = useMemo(() => [
    { label: "Registrations", value: data.stats.registeredEvents || 0 },
    { label: "Checked in", value: data.stats.checkedIn || 0 },
    { label: "Waitlisted", value: data.stats.waitlisted || 0 },
    { label: "Completed", value: data.stats.completedEvents || 0 },
  ], [data]);

  return (
    <div className="content-panel">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-badge">Achievements</span>
          <h1>Turn participation into milestones.</h1>
          <p>Badges and progress markers help you keep campus growth visible over the years.</p>
        </div>
        <div className="hero-stats">
          <div className="stat-card"><strong>{data.points}</strong><span>Points earned</span></div>
          <div className="stat-card"><strong>{data.badges.length}</strong><span>Badges unlocked</span></div>
        </div>
      </section>

      {loading ? (
        <AsyncState variant="loading" title="Loading achievements" description="Collecting your milestone history." />
      ) : error ? (
        <AsyncState variant="error" title="Could not load achievements" description={error} actionLabel="Retry" onAction={fetchData} />
      ) : (
        <div className="dashboard-grid">
          <section className="chart-card">
            <div className="section-head compact"><div><h2>Milestone progress</h2><p className="muted">A compact summary of your engagement.</p></div><div className="section-icon"><FaChartLine /></div></div>
            <div className="mini-stats">
              {progress.map((item) => <div key={item.label} className="mini-card"><strong>{item.value}</strong><span>{item.label}</span></div>)}
            </div>
            <div className="mini-report">
              <p className="detail-label">Profile pointers</p>
              <div className="tag-row">
                <span className="mini-tag"><FaStar /> Regular activity</span>
                <span className="mini-tag"><FaCheckCircle /> Attendance matters</span>
                <span className="mini-tag"><FaHourglassHalf /> Waitlist progress counts</span>
              </div>
            </div>
          </section>

          <section className="form-card">
            <div className="section-head compact"><div><h2>Unlocked badges</h2><p className="muted">Your current long-term milestones.</p></div><div className="section-icon"><FaMedal /></div></div>
            <div className="event-grid">
              {data.badges.length > 0 ? data.badges.map((badge) => (
                <motion.article key={badge.id} className="event-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="event-top"><span className="event-tag">Badge</span><span className="event-date status-live">Unlocked</span></div>
                  <h3>{badge.label}</h3>
                  <p>{badge.text}</p>
                </motion.article>
              )) : <AsyncState variant="empty" title="No badges unlocked yet" description="Keep attending events to build your profile." />}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
