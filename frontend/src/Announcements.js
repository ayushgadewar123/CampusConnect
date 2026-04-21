import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FaBullhorn, FaThumbtack, FaTrash, FaPlus } from "react-icons/fa";
import api from "./lib/api";
import { useAuth } from "./context/AuthContext";
import AsyncState from "./components/AsyncState";

const initialForm = {
  title: "",
  message: "",
  audience: "all",
  event: "",
  isPinned: false,
  expiresAt: "",
  sendEmail: false,
};

export default function Announcements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/announcements");
      setAnnouncements(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      const message =
        error.response?.data?.message || "Could not load announcements";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleChange = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const createAnnouncement = async () => {
    try {
      if (!form.title || !form.message) {
        toast.error("Title and message are required");
        return;
      }
      await api.post("/api/announcements", form);
      toast.success("Announcement published");
      setForm(initialForm);
      fetchData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not publish announcement"
      );
    }
  };

  const togglePin = async (id) => {
    try {
      await api.patch(`/api/announcements/${id}/pin`);
      toast.success("Announcement updated");
      fetchData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Pin update failed"
      );
    }
  };

  const removeAnnouncement = async (id) => {
    try {
      await api.delete(`/api/announcements/${id}`);
      toast.success("Announcement archived");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Delete failed");
    }
  };

  const canManage = ["admin", "super_admin"].includes(user?.role);

  return (
    <div className="content-panel">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-badge">Announcements</span>
          <h1>Campus updates, reminders, and urgent notices.</h1>
          <p>Keep everyone aligned with one central announcement feed.</p>
        </div>
        <div className="hero-stats">
          <div className="stat-card">
            <strong>{announcements.length}</strong>
            <span>Visible</span>
          </div>
          <div className="stat-card">
            <strong>
              {announcements.filter((item) => item.isPinned).length}
            </strong>
            <span>Pinned</span>
          </div>
        </div>
      </section>

      {canManage && (
        <section className="card-surface" style={{ marginBottom: 24 }}>
          <div className="section-head compact">
            <div>
              <h2>Publish announcement</h2>
              <p className="muted">
                Admins can push updates instantly.
              </p>
            </div>
            <div className="section-icon">
              <FaPlus />
            </div>
          </div>

          <div className="field-grid two">
            <input
              id="announcement-title"
              name="title"
              value={form.title}
              onChange={(e) =>
                handleChange("title", e.target.value)
              }
              placeholder="Title"
            />

            <select
              id="announcement-audience"
              name="audience"
              value={form.audience}
              onChange={(e) =>
                handleChange("audience", e.target.value)
              }
            >
              <option value="all">All</option>
              <option value="students">Students</option>
              <option value="coordinators">Coordinators</option>
              <option value="volunteers">Volunteers</option>
              <option value="admins">Admins</option>
              <option value="event_participants">
                Event participants
              </option>
            </select>
          </div>

          <textarea
            id="announcement-message"
            name="message"
            rows="4"
            value={form.message}
            onChange={(e) =>
              handleChange("message", e.target.value)
            }
            placeholder="Announcement message"
          />

          <div className="field-grid three">
            <input
              id="announcement-expiresAt"
              name="expiresAt"
              type="date"
              value={form.expiresAt}
              onChange={(e) =>
                handleChange("expiresAt", e.target.value)
              }
            />

            <input
              id="announcement-event"
              name="event"
              value={form.event}
              onChange={(e) =>
                handleChange("event", e.target.value)
              }
              placeholder="Event ID (optional)"
            />

            <label
              htmlFor="announcement-pinned"
              className="toggle-pill"
              style={{ display: "inline-flex", gap: 8 }}
            >
              <input
                id="announcement-pinned"
                name="isPinned"
                type="checkbox"
                checked={form.isPinned}
                onChange={(e) =>
                  handleChange("isPinned", e.target.checked)
                }
              />
              Pin to top
            </label>
          </div>

          <label
            htmlFor="announcement-sendEmail"
            className="toggle-pill"
            style={{
              display: "inline-flex",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <input
              id="announcement-sendEmail"
              name="sendEmail"
              type="checkbox"
              checked={form.sendEmail}
              onChange={(e) =>
                handleChange("sendEmail", e.target.checked)
              }
            />
            Send email notifications
          </label>

          <button
            className="primary-btn"
            type="button"
            onClick={createAnnouncement}
          >
            Publish announcement
          </button>
        </section>
      )}

      {loading ? (
        <AsyncState
          variant="loading"
          title="Loading announcements"
          description="Fetching the latest campus notices."
        />
      ) : error ? (
        <AsyncState
          variant="error"
          title="Could not load announcements"
          description={error}
          actionLabel="Retry"
          onAction={fetchData}
        />
      ) : announcements.length === 0 ? (
        <AsyncState
          variant="empty"
          title="No announcements yet"
          description="Post the first notice to keep students informed."
          actionLabel="Refresh"
          onAction={fetchData}
        />
      ) : (
        <div className="timeline-list">
          {announcements.map((item) => (
            <motion.article
              key={item._id}
              className="notification-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="notification-icon">
                <FaBullhorn />
              </div>

              <div>
                <h3>
                  {item.title}
                  {item.isPinned ? " • pinned" : ""}
                </h3>
                <p>{item.message}</p>
                <p className="muted">
                  {item.audience} •{" "}
                  {item.createdBy?.name || "Campus team"}
                </p>
              </div>

              {canManage && (
                <div className="card-actions wrap">
                  <button
                    className="secondary-btn tiny"
                    type="button"
                    onClick={() => togglePin(item._id)}
                  >
                    <FaThumbtack />{" "}
                    {item.isPinned ? "Unpin" : "Pin"}
                  </button>

                  <button
                    className="secondary-btn tiny"
                    type="button"
                    onClick={() => removeAnnouncement(item._id)}
                  >
                    <FaTrash /> Archive
                  </button>
                </div>
              )}
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}