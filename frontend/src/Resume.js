import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FaDownload, FaCertificate, FaStar } from "react-icons/fa";
import api from "./lib/api";
import AsyncState from "./components/AsyncState";

export default function Resume() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/dashboard/resume");
      setData(res.data || null);
    } catch (error) {
      const message = error.response?.data?.message || "Could not load resume data";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const downloadText = () => {
    if (!data) return;
    const lines = [];
    lines.push(`Name: ${data.profile?.name || ""}`);
    lines.push(`Email: ${data.profile?.email || ""}`);
    lines.push(`Department: ${data.profile?.department || ""}`);
    lines.push(`Year: ${data.profile?.year || ""}`);
    lines.push(`Total Events: ${data.stats?.total ?? 0}`);
    lines.push(`Completed Events: ${data.stats?.completed ?? 0}`);
    lines.push(`Checked In: ${data.stats?.checkedIn ?? 0}`);
    lines.push(`Waitlisted: ${data.stats?.waitlisted ?? 0}`);
    lines.push(`Interests: ${(data.profile?.interests || []).join(", ")}`);
    lines.push(`Skills: ${(data.profile?.skills || []).join(", ")}`);
    lines.push("
Certificates:");
    (data.certificates || []).forEach((cert) => lines.push(`- ${cert.title} (${cert.certificateCode})`));
    lines.push("
Feedback:");
    (data.feedback || []).forEach((item) => lines.push(`- ${item.event?.title || "Event"}: ${item.rating}/5`));

    const blob = new Blob([lines.join("
")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "campusconnect-resume.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Resume export downloaded");
  };

  const stats = useMemo(() => data?.stats || {}, [data]);

  return (
    <div className="content-panel">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-badge">Resume export</span>
          <h1>A portfolio-style summary of your campus activity.</h1>
          <p>Use this for internships, clubs, or personal records.</p>
        </div>
        <div className="hero-stats">
          <div className="stat-card"><strong>{stats.total ?? 0}</strong><span>Events</span></div>
          <div className="stat-card"><strong>{stats.completed ?? 0}</strong><span>Completed</span></div>
          <div className="stat-card"><button className="secondary-btn tiny" type="button" onClick={downloadText}><FaDownload /> Download</button></div>
        </div>
      </section>

      {loading ? (
        <AsyncState variant="loading" title="Loading resume data" description="Preparing your profile export and activity summary." />
      ) : error ? (
        <AsyncState variant="error" title="Could not load resume data" description={error} actionLabel="Retry" onAction={fetchData} />
      ) : !data ? (
        <AsyncState variant="empty" title="No data found" description="Your profile will appear here after registrations and check-ins." actionLabel="Refresh" onAction={fetchData} />
      ) : (
        <>
          <div className="dashboard-grid">
            <section className="form-card">
              <div className="section-head compact"><div><h2>{data.profile?.name || "Student"}</h2><p className="muted">{data.profile?.email}</p></div></div>
              <div className="detail-grid">
                <div><p className="detail-label">Department</p><p>{data.profile?.department || "—"}</p></div>
                <div><p className="detail-label">Year</p><p>{data.profile?.year || "—"}</p></div>
                <div><p className="detail-label">Points</p><p>{(data.profile?.badges || []).length * 10 + (data.stats?.completed || 0) * 20}</p></div>
                <div><p className="detail-label">Waitlisted</p><p>{stats.waitlisted ?? 0}</p></div>
              </div>
              <div>
                <p className="detail-label">Interests</p>
                <div className="tag-row">{(data.profile?.interests || []).map((item) => <span key={item} className="mini-tag">{item}</span>)}</div>
              </div>
              <div style={{ marginTop: 16 }}>
                <p className="detail-label">Skills</p>
                <div className="tag-row">{(data.profile?.skills || []).map((item) => <span key={item} className="mini-tag">{item}</span>)}</div>
              </div>
            </section>

            <section className="chart-card">
              <div className="section-head compact"><div><h2>Certificates</h2><p className="muted">Completed and verified activity.</p></div><div className="section-icon"><FaCertificate /></div></div>
              <div className="timeline-list">
                {(data.certificates || []).length === 0 ? <AsyncState variant="empty" title="No certificates yet" description="Attend and check in to build your archive." /> : data.certificates.slice(0, 8).map((cert) => (
                  <motion.article key={cert.id} className="notification-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="notification-icon"><FaCertificate /></div>
                    <div>
                      <h3>{cert.title}</h3>
                      <p>{cert.certificateCode}</p>
                      <p className="muted">{cert.category} • {new Date(cert.date).toLocaleDateString()}</p>
                    </div>
                  </motion.article>
                ))}
              </div>
            </section>
          </div>

          <section className="card-surface" style={{ marginTop: 24 }}>
            <div className="section-head compact"><div><h2>Feedback log</h2><p className="muted">Your event reviews across the campus.</p></div><div className="section-icon"><FaStar /></div></div>
            <div className="timeline-list">
              {(data.feedback || []).length === 0 ? <AsyncState variant="empty" title="No feedback submitted yet" description="Add one review after each event to build your portfolio." /> : data.feedback.slice(0, 10).map((item) => (
                <div key={item._id} className="timeline-item">
                  <strong>{item.event?.title || "Event"}</strong>
                  <span>{item.rating}/5 • {item.comment || "No comment"}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
