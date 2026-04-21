import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FaServer, FaMemory, FaClock, FaDatabase, FaShieldAlt, FaDownload, FaBolt, FaPlayCircle, FaHistory } from "react-icons/fa";
import api from "./lib/api";
import getSocket from "./lib/socket";
import AsyncState from "./components/AsyncState";

const prettyBytes = (value = 0) => {
  const num = Number(value) || 0;
  if (num >= 1024 * 1024 * 1024) return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (num >= 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(2)} MB`;
  if (num >= 1024) return `${(num / 1024).toFixed(2)} KB`;
  return `${num} B`;
};

export default function AdminSystem() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState([]);
  const [queueHistory, setQueueHistory] = useState([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [overviewRes, historyRes, queueRes] = await Promise.all([
          api.get("/api/system/overview"),
          api.get("/api/system/history?limit=8"),
          api.get("/api/system/queue"),
        ]);
        if (mounted) {
          setOverview(overviewRes.data || null);
          setHistory(Array.isArray(historyRes.data?.runs) ? historyRes.data.runs : []);
          setQueueHistory(Array.isArray(queueRes.data?.stats?.recentJobs) ? queueRes.data.stats.recentJobs : []);
          setError("");
        }
      } catch (error) {
        const message = error.response?.data?.message || "Could not load system status";
        if (mounted) setError(message);
        toast.error(message);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("join:admin");
    const refresh = async () => {
      try {
        const [overviewRes, historyRes, queueRes] = await Promise.all([
          api.get("/api/system/overview"),
          api.get("/api/system/history?limit=8"),
          api.get("/api/system/queue"),
        ]);
        setOverview(overviewRes.data || null);
        setHistory(Array.isArray(historyRes.data?.runs) ? historyRes.data.runs : []);
        setQueueHistory(Array.isArray(queueRes.data?.stats?.recentJobs) ? queueRes.data.stats.recentJobs : []);
      } catch (error) {
        // keep silent on background refresh
      }
    };
    socket.on('jobqueue:update', refresh);
    socket.on('maintenance:update', refresh);
    return () => {
      socket.off('jobqueue:update', refresh);
      socket.off('maintenance:update', refresh);
    };
  }, []);

  const runMaintenance = async () => {
    try {
      setRunning(true);
      const res = await api.post("/api/system/maintenance/run", { reason: "manual-admin" });
      setOverview((prev) => ({ ...prev, jobs: res.data?.result || prev?.jobs }));
      toast.success(res.data?.message || "Maintenance sweep started");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to run maintenance");
    } finally {
      setRunning(false);
    }
  };
  const retryJob = async (jobId) => {
    try {
      await api.post(`/api/system/queue/${jobId}/retry`);
      toast.success('Job re-queued');
      const queueRes = await api.get('/api/system/queue');
      setQueueHistory(Array.isArray(queueRes.data?.stats?.recentJobs) ? queueRes.data.stats.recentJobs : []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not retry job');
    }
  };

  const downloadEnvExample = async () => {
    try {
      const blob = new Blob([
        [
          "# Backend",
          "PORT=5000",
          "NODE_ENV=development",
          "TRUST_PROXY=1",
          "API_RATE_LIMIT=500",
          "MONGO_URI=mongodb://127.0.0.1:27017/campusconnect",
          "JWT_SECRET=replace_with_a_long_random_secret",
          "JWT_REFRESH_SECRET=replace_with_a_long_random_refresh_secret",
          "JWT_EXPIRES_IN=15m",
          "JWT_REFRESH_EXPIRES_IN=7d",
          "FRONTEND_URL=http://localhost:3000",
          "SMTP_HOST=",
          "SMTP_PORT=587",
          "SMTP_SECURE=false",
          "SMTP_USER=",
          "SMTP_PASS=",
          "EMAIL_FROM=CampusConnect <no-reply@campusconnect.local>",
          "EMAIL_ASYNC_QUEUE=true",
          "JOB_QUEUE_POLL_MS=5000",
          "QUEUE_MAX_ATTEMPTS=3",
          "EMAIL_BULK_CAP=25",
          "SMTP_POOL=true",
          "SMTP_POOL_MAX_CONNECTIONS=1",
          "SMTP_POOL_MAX_MESSAGES=50",
          "SMTP_RATE_DELTA_MS=1000",
          "SMTP_RATE_LIMIT=5",
          "SMTP_CONNECTION_TIMEOUT_MS=20000",
          "SMTP_GREETING_TIMEOUT_MS=20000",
          "SMTP_SOCKET_TIMEOUT_MS=30000",
          "SMTP_REQUIRE_TLS=true",
          "DISABLE_EMAILS=true",
          "CLOUDINARY_CLOUD_NAME=",
          "CLOUDINARY_API_KEY=",
          "CLOUDINARY_API_SECRET=",
          "MAINTENANCE_INTERVAL_MS=900000",
          "# Frontend",
          "REACT_APP_API_URL=http://localhost:5000",
          "REACT_APP_APP_NAME=CampusConnect",
          "REACT_APP_ENABLE_DEMO=true",
        ].join("\n"),
      ], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "campusconnect.env.example.txt";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Failed to generate env example");
    }
  };

  if (loading) {
    return <AsyncState variant="loading" title="Loading system overview" description="Checking runtime health and queue status." />;
  }

  if (error && !overview) {
    return <AsyncState variant="error" title="Could not load system overview" description={error} actionLabel="Retry" onAction={() => window.location.reload()} />;
  }

  return (
    <div className="content-panel">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-badge">Production</span>
          <h1>System status and deployment readiness.</h1>
          <p>Track runtime health, memory usage, database connectivity, and environment state.</p>
        </div>
        <div className="hero-stats">
          <div className="stat-card"><strong>{overview?.db?.connected ? "Healthy" : "Check"}</strong><span>App status</span></div>
          <div className="stat-card"><strong>{overview?.environment || "dev"}</strong><span>Environment</span></div>
          <div className="stat-card"><strong>{overview?.cache?.size ?? 0}</strong><span>Cache entries</span></div>
          <div className="stat-card"><button className="secondary-btn tiny" type="button" onClick={runMaintenance} disabled={running}><FaBolt /> {running ? "Running…" : "Run maintenance"}</button></div>
          <div className="stat-card"><button className="secondary-btn tiny" type="button" onClick={downloadEnvExample}><FaDownload /> Env example</button></div>
        </div>
      </section>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="section-head compact">
          <div>
            <h2>Maintenance history</h2>
            <p className="muted">Recent automated or manual maintenance runs.</p>
          </div>
          <div className="section-icon"><FaHistory /></div>
        </div>
        {history.length === 0 ? (
          <div className="empty-state"><p>No maintenance runs recorded yet.</p></div>
        ) : (
          <div className="timeline-list">
            {history.map((run) => (
              <div key={run._id} className="timeline-item">
                <strong>{run.reason}</strong>
                <span>{run.status} • {new Date(run.createdAt || run.startedAt).toLocaleString()}</span>
                <span className="muted">{run.durationMs || 0} ms • {run.summary?.updatedEvents || 0} events updated • {run.summary?.reminderEmails || 0} reminder emails • {run.summary?.digestEmails || 0} digest emails</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="dashboard-grid" style={{ marginTop: 24 }}>
        <motion.article className="stat-card large" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <FaServer />
          <strong>{overview?.hostname || "-"}</strong>
          <span>Host machine</span>
        </motion.article>
        <motion.article className="stat-card large" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <FaClock />
          <strong>{overview?.uptimeSeconds || 0}s</strong>
          <span>Uptime</span>
        </motion.article>
        <motion.article className="stat-card large" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <FaDatabase />
          <strong>{overview?.db?.connected ? "Connected" : "Offline"}</strong>
          <span>MongoDB</span>
        </motion.article>
        <motion.article className="stat-card large" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <FaMemory />
          <strong>{prettyBytes(overview?.memory?.heapUsed)}</strong>
          <span>Heap used</span>
        </motion.article>
      </div>


      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="section-head compact">
          <div>
            <h2>Automated jobs</h2>
            <p className="muted">Reminder sweeps keep event lifecycle, notifications, and cleanup in sync.</p>
          </div>
          <div className="section-icon"><FaPlayCircle /></div>
        </div>
        <div className="dashboard-grid reports-grid">
          <div className="notification-card">
            <p className="detail-label">Last run</p>
            <strong>{overview?.jobs?.lastRunAt ? new Date(overview.jobs.lastRunAt).toLocaleString() : "Never"}</strong>
            <p className="muted">Reason: {overview?.jobs?.lastReason || "-"}</p>
          </div>
          <div className="notification-card">
            <p className="detail-label">Duration</p>
            <strong>{overview?.jobs?.lastDurationMs ?? 0} ms</strong>
            <p className="muted">Next run: {overview?.jobs?.nextRunAt ? new Date(overview.jobs.nextRunAt).toLocaleString() : "Scheduled on server"}</p>
          </div>
          <div className="notification-card">
            <p className="detail-label">Reminder emails</p>
            <strong>{overview?.jobs?.lastSummary?.reminderEmails ?? 0}</strong>
            <p className="muted">Notifications: {overview?.jobs?.lastSummary?.reminderNotifications ?? 0}</p>
          </div>
          <div className="notification-card">
            <p className="detail-label">Lifecycle updates</p>
            <strong>{overview?.jobs?.lastSummary?.updatedEvents ?? 0}</strong>
            <p className="muted">Expired notifications cleaned: {overview?.jobs?.lastSummary?.cleanedNotifications ?? 0}</p>
          </div>
        </div>
      </section>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="section-head compact">
          <div>
            <h2>Background job queue</h2>
            <p className="muted">Queued email jobs with automatic retries and admin visibility.</p>
          </div>
          <div className="section-icon"><FaBolt /></div>
        </div>
        <div className="dashboard-grid reports-grid">
          <div className="notification-card">
            <p className="detail-label">Queued</p>
            <strong>{overview?.queue?.queued ?? 0}</strong>
            <p className="muted">Waiting or retrying jobs</p>
          </div>
          <div className="notification-card">
            <p className="detail-label">Failed</p>
            <strong>{overview?.queue?.failed ?? 0}</strong>
            <p className="muted">Jobs that exhausted retries</p>
          </div>
          <div className="notification-card">
            <p className="detail-label">Processed</p>
            <strong>{overview?.queue?.total ?? 0}</strong>
            <p className="muted">Tracked by the queue table</p>
          </div>
          <div className="notification-card">
            <p className="detail-label">Poll interval</p>
            <strong>{Math.round((overview?.queue?.state?.intervalMs || 5000) / 1000)}s</strong>
            <p className="muted">Background worker cadence</p>
          </div>
        </div>
        <div className="timeline-list" style={{ marginTop: 16 }}>
          {queueHistory.length === 0 ? (
            <div className="empty-state"><p>No queued jobs yet.</p></div>
          ) : queueHistory.map((job) => (
            <div key={job._id} className="timeline-item">
              <strong>{job.type}</strong>
              <span>{job.status} • {new Date(job.createdAt || job.runAt).toLocaleString()}</span>
              <span className="muted">Attempts {job.attempts}/{job.maxAttempts}{job.error ? ` • ${job.error}` : ''}</span>
              {(job.status === 'failed' || job.status === 'retry_wait') && (
                <button className="secondary-btn tiny" type="button" onClick={() => retryJob(job._id)}>Retry job</button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="section-head compact">
          <div>
            <h2>Runtime details</h2>
            <p className="muted">Useful for production support and incident triage.</p>
          </div>
          <div className="section-icon"><FaShieldAlt /></div>
        </div>
        <div className="dashboard-grid reports-grid">
          <div className="notification-card">
            <p className="detail-label">Node version</p>
            <strong>{overview?.node}</strong>
            <p className="muted">PID: {overview?.pid}</p>
          </div>
          <div className="notification-card">
            <p className="detail-label">Platform</p>
            <strong>{overview?.platform}</strong>
            <p className="muted">Environment: {overview?.environment}</p>
          </div>
          <div className="notification-card">
            <p className="detail-label">RSS</p>
            <strong>{prettyBytes(overview?.memory?.rss)}</strong>
            <p className="muted">Total resident memory</p>
          </div>
          <div className="notification-card">
            <p className="detail-label">Heap total</p>
            <strong>{prettyBytes(overview?.memory?.heapTotal)}</strong>
            <p className="muted">Allocated V8 heap</p>
          </div>
          <div className="notification-card">
            <p className="detail-label">Cache prefixes</p>
            <strong>{Object.keys(overview?.cache?.prefixes || {}).length}</strong>
            <p className="muted">Cached data groups</p>
          </div>
        </div>
      </section>
    </div>
  );
}
