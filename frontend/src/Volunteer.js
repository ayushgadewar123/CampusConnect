import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FaTasks, FaCalendarAlt, FaClipboardList, FaHistory, FaCheck, FaSpinner, FaPlay } from "react-icons/fa";
import api from "./lib/api";
import AsyncState from "./components/AsyncState";

const statusLabel = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
};

export default function Volunteer() {
  const [data, setData] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboardRes, assignmentsRes] = await Promise.all([
        api.get("/api/dashboard/volunteer"),
        api.get("/api/volunteers/me").catch(() => ({ data: { assignments: [] } })),
      ]);
      setData(dashboardRes.data || null);
      setAssignments(Array.isArray(assignmentsRes.data?.assignments) ? assignmentsRes.data.assignments : []);
    } catch (error) {
      const message = error.response?.data?.message || "Could not load volunteer dashboard";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateAssignment = async (assignmentId, status) => {
    try {
      setUpdatingId(assignmentId);
      await api.patch(`/api/volunteers/${assignmentId}`, { status });
      toast.success(`Task marked ${statusLabel[status] || status}`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Task update failed");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="content-panel">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-badge">Volunteer dashboard</span>
          <h1>Task view for coordinators and volunteers.</h1>
          <p>Track live duties, upcoming events, and help requests in one place.</p>
        </div>
        <div className="hero-stats">
          <div className="stat-card"><strong>{data?.upcomingEvents?.length || 0}</strong><span>Upcoming</span></div>
          <div className="stat-card"><strong>{data?.pendingApprovals?.length || 0}</strong><span>Pending</span></div>
          <div className="stat-card"><strong>{data?.tasks?.length || 0}</strong><span>Tasks</span></div>
        </div>
      </section>

      {loading ? (
        <AsyncState variant="loading" title="Loading volunteer dashboard" description="Preparing tasks, approvals, and recent activity." />
      ) : error ? (
        <AsyncState variant="error" title="Could not load volunteer dashboard" description={error} actionLabel="Retry" onAction={fetchData} />
      ) : !data ? (
        <AsyncState variant="empty" title="No data available" description="The volunteer workspace will appear when the backend provides it." actionLabel="Refresh" onAction={fetchData} />
      ) : (
        <>
          <section className="card-surface">
            <div className="section-head compact"><div><h2>Tasks</h2><p className="muted">Quick actions for the support team.</p></div><div className="section-icon"><FaTasks /></div></div>
            <div className="event-grid">
              {data.tasks.map((task) => (
                <motion.article key={task.id} className="event-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <h3>{task.title}</h3>
                  <p>{task.detail}</p>
                </motion.article>
              ))}
            </div>
          </section>

          <div className="dashboard-grid" style={{ marginTop: 24 }}>
            <section className="chart-card">
              <div className="section-head compact"><div><h2>Upcoming events</h2><p className="muted">Events that may need volunteer attention.</p></div><div className="section-icon"><FaCalendarAlt /></div></div>
              <div className="timeline-list">
                {(data.upcomingEvents || []).slice(0, 8).map((event) => (
                  <div key={event._id} className="timeline-item">
                    <strong>{event.title}</strong>
                    <span>{event.venue} • {event.category}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="chart-card">
              <div className="section-head compact"><div><h2>My registrations</h2><p className="muted">What you have already joined.</p></div><div className="section-icon"><FaClipboardList /></div></div>
              <div className="timeline-list">
                {(data.myRegistrations || []).slice(0, 8).map((item) => (
                  <div key={item._id} className="timeline-item">
                    <strong>{item.event?.title || "Event"}</strong>
                    <span>{item.status} • {item.event?.status || "upcoming"}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="card-surface" style={{ marginTop: 24 }}>
            <div className="section-head compact"><div><h2>Approval queue</h2><p className="muted">Draft or approval-required events.</p></div><div className="section-icon"><FaClipboardList /></div></div>
            <div className="event-grid">
              {(data.pendingApprovals || []).slice(0, 6).map((event) => (
                <motion.article key={event._id} className="event-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <h3>{event.title}</h3>
                  <p className="clamp-3">{event.description}</p>
                  <div className="event-meta"><span>📍 {event.venue}</span><span>{new Date(event.date).toLocaleDateString()}</span></div>
                </motion.article>
              ))}
            </div>
          </section>

          <section className="card-surface" style={{ marginTop: 24 }}>
            <div className="section-head compact"><div><h2>Assigned volunteer tasks</h2><p className="muted">Track work items and completion progress.</p></div><div className="section-icon"><FaTasks /></div></div>
            <div className="timeline-list">
              {assignments.length === 0 ? <AsyncState variant="empty" title="No assignments yet" description="Volunteer tasks will appear here when they are assigned." /> : assignments.map((item) => (
                <div key={item._id} className="timeline-item" style={{ display: "grid", gap: 10 }}>
                  <div>
                    <strong>{item.taskTitle}</strong>
                    <span>{item.event?.title || "Event"} • {item.status} {item.completedAt ? `• done ${new Date(item.completedAt).toLocaleDateString()}` : ""}</span>
                  </div>
                  <div className="card-actions wrap">
                    {item.status !== "in_progress" && item.status !== "completed" && (
                      <button className="secondary-btn tiny" type="button" onClick={() => updateAssignment(item._id, "in_progress")} disabled={updatingId === item._id}>
                        {updatingId === item._id ? <FaSpinner className="spinner" /> : <FaPlay />} Start
                      </button>
                    )}
                    {item.status !== "completed" && (
                      <button className="primary-btn tiny" type="button" onClick={() => updateAssignment(item._id, "completed")} disabled={updatingId === item._id}>
                        {updatingId === item._id ? <FaSpinner className="spinner" /> : <FaCheck />} Complete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card-surface" style={{ marginTop: 24 }}>
            <div className="section-head compact"><div><h2>Recent logs</h2><p className="muted">A quick audit-style snapshot.</p></div><div className="section-icon"><FaHistory /></div></div>
            <div className="timeline-list">
              {(data.recentLogs || []).slice(0, 8).map((log) => (
                <div key={log._id} className="timeline-item">
                  <strong>{log.action}</strong>
                  <span>{log.title || log.entityType} • {log.actorName || "System"}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
