import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  FaPlus,
  FaTrash,
  FaEdit,
  FaSearch,
  FaChartBar,
  FaCalendarAlt,
  FaUsers,
  FaTicketAlt,
  FaUserShield,
  FaClipboardList,
  FaFileExport,
  FaCheckCircle,
  FaPaperPlane,
  FaArchive,
} from "react-icons/fa";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, PieChart, Pie, Legend } from "recharts";
import api from "./lib/api";
import getSocket from "./lib/socket";

const initialForm = {
  title: "",
  description: "",
  date: "",
  endDate: "",
  venue: "",
  category: "General",
  subcategory: "",
  mode: "offline",
  status: "draft",
  featured: false,
  approvalRequired: false,
  capacity: "",
  waitlistCapacity: "",
  organizerName: "",
  speakerName: "",
  speakerRole: "",
  schedule: "",
  tags: "",
  imageUrl: "",
  locationUrl: "",
  attachments: "",
  rules: "",
  certificateEnabled: true,
  certificateTemplateUrl: "",
};

export default function AdminDashboard() {
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [reports, setReports] = useState(null);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsRange, setAnalyticsRange] = useState("90");
  const [uploading, setUploading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, registrationsRes, statsRes, usersRes, reportsRes, pendingRes, analyticsRes] = await Promise.all([
        api.get("/api/events"),
        api.get("/api/registrations"),
        api.get("/api/admin/dashboard"),
        api.get("/api/admin/users"),
        api.get("/api/admin/reports"),
        api.get("/api/events/pending"),
        api.get(`/api/admin/analytics?range=${analyticsRange}`),
      ]);
      setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
      setRegistrations(Array.isArray(registrationsRes.data) ? registrationsRes.data : []);
      setDashboardStats(statsRes.data || null);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setReports(reportsRes.data || null);
      setPendingEvents(Array.isArray(pendingRes.data) ? pendingRes.data : []);
      setAnalytics(analyticsRes.data || null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, [analyticsRange]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("join:admin");
    const refresh = () => fetchData();
    socket.on("dashboard:update", refresh);
    socket.on("announcement:update", refresh);
    socket.on("event:update", refresh);
    socket.on("registration:update", refresh);
    return () => {
      socket.off("dashboard:update", refresh);
      socket.off("announcement:update", refresh);
      socket.off("event:update", refresh);
      socket.off("registration:update", refresh);
    };
  }, [fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => { setForm(initialForm); setEditingId(null); };
  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    try {
      if (!form.title || !form.description || !form.date || !form.venue) {
        toast.error("Title, description, date, and venue are required");
        return;
      }
      const payload = {
        ...form,
        capacity: form.capacity === "" ? null : Number(form.capacity),
        waitlistCapacity: form.waitlistCapacity === "" ? null : Number(form.waitlistCapacity),
        tags: form.tags,
        attachments: form.attachments,
        rules: form.rules,
        certificateEnabled: form.certificateEnabled,
        posterUrl: form.imageUrl,
        certificateTemplateUrl: form.certificateTemplateUrl,
      };
      if (editingId) {
        await api.put(`/api/events/${editingId}`, payload);
        toast.success("Event updated");
      } else {
        await api.post("/api/events", payload);
        toast.success("Event created");
      }
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    }
  };

  const handleEdit = (event) => {
    setEditingId(event._id);
    setForm({
      title: event.title || "",
      description: event.description || "",
      date: event.date ? new Date(event.date).toISOString().slice(0, 10) : "",
      endDate: event.endDate ? new Date(event.endDate).toISOString().slice(0, 10) : "",
      venue: event.venue || "",
      category: event.category || "General",
      subcategory: event.subcategory || "",
      mode: event.mode || "offline",
      status: event.status || "upcoming",
      featured: Boolean(event.featured),
      approvalRequired: Boolean(event.approvalRequired),
      capacity: event.capacity ?? "",
      waitlistCapacity: event.waitlistCapacity ?? "",
      organizerName: event.organizerName || "",
      speakerName: event.speakerName || "",
      speakerRole: event.speakerRole || "",
      schedule: event.schedule || "",
      tags: Array.isArray(event.tags) ? event.tags.join(", ") : "",
      imageUrl: event.imageUrl || "",
      locationUrl: event.locationUrl || "",
      attachments: Array.isArray(event.attachments) ? event.attachments.join(", ") : "",
      rules: event.rules || "",
      certificateEnabled: event.certificateEnabled ?? true,
      certificateTemplateUrl: event.certificateTemplateUrl || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleApprove = async (id) => {
    try {
      await api.patch(`/api/events/${id}/approve`);
      toast.success("Event approved");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Approval failed");
    }
  };

  const handlePublish = async (id) => {
    try {
      await api.patch(`/api/events/${id}/publish`);
      toast.success("Event published");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Publish failed");
    }
  };

  const downloadExport = async (type) => {
    try {
      const res = await api.get(`/api/admin/export/${type}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${type}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${type} export downloaded`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Export failed");
    }
  };

  const downloadReportsExport = async (format = "csv") => {
    try {
      const res = await api.get(`/api/admin/reports/export?format=${format}&range=${analyticsRange}`, { responseType: "blob" });
      const mimeType = format === "json" ? "application/json;charset=utf-8;" : "text/csv;charset=utf-8;";
      const ext = format === "json" ? "json" : "csv";
      const url = window.URL.createObjectURL(new Blob([res.data], { type: mimeType }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `campusconnect-reports-${analyticsRange}d.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Reports ${ext.toUpperCase()} downloaded`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Reports export failed");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/events/${id}`);
      toast.success("Event archived");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  };

  const handleCheckIn = async (registrationId) => {
    try {
      await api.patch(`/api/registrations/${registrationId}/checkin`);
      toast.success("Attendance marked");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Check-in failed");
    }
  };

  const updateRole = async (userId, role) => {
    try {
      await api.patch(`/api/admin/users/${userId}/role`, { role });
      toast.success("Role updated");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Role update failed");
    }
  };

  const uploadAsset = async (file, targetField) => {
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/api/uploads/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.url || "";
      if (targetField) {
        updateField(targetField, url);
      }
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };
  const seedDemoEvents = async () => {
    const base = new Date();
    const addDays = (days) => {
      const next = new Date(base);
      next.setDate(next.getDate() + days);
      return next.toISOString().slice(0, 10);
    };

    const templates = [
      { title: "Campus Hackathon 2026", description: "A high-energy 24-hour build sprint for developers, designers, and problem solvers.", date: addDays(7), endDate: addDays(8), venue: "Innovation Lab", category: "Hackathon", mode: "hybrid", status: "upcoming", featured: true, approvalRequired: true, capacity: 200, waitlistCapacity: 50, organizerName: "Coding Club", tags: ["AI", "startup", "teamwork"] },
      { title: "Rhythm & Roots Fest", description: "A cultural night filled with music, dance, and stage performances from all departments.", date: addDays(12), endDate: addDays(12), venue: "Main Auditorium", category: "Cultural", mode: "offline", status: "published", featured: true, approvalRequired: false, capacity: 600, waitlistCapacity: 0, organizerName: "Cultural Committee", tags: ["dance", "music", "festival"] },
      { title: "Sports Championship Day", description: "Inter-college finals for cricket, football, badminton, and track events.", date: addDays(18), endDate: addDays(18), venue: "Sports Ground", category: "Sports", mode: "offline", status: "upcoming", featured: false, approvalRequired: false, capacity: 800, waitlistCapacity: 0, organizerName: "Sports Council", tags: ["fitness", "championship", "team"] },
      { title: "Resume & Interview Bootcamp", description: "Placement prep with CV reviews, interview mock sessions, and industry tips.", date: addDays(4), endDate: addDays(4), venue: "Seminar Hall B", category: "Placement", mode: "online", status: "live", featured: true, approvalRequired: false, capacity: 150, waitlistCapacity: 0, organizerName: "Training & Placement Cell", tags: ["career", "resume", "interview"] },
      { title: "Data Science Masterclass", description: "A seminar on practical analytics, dashboards, and modern ML workflows.", date: addDays(15), endDate: addDays(15), venue: "Lecture Hall 2", category: "Seminar", mode: "hybrid", status: "draft", featured: false, approvalRequired: true, capacity: 120, waitlistCapacity: 0, organizerName: "IT Department", speakerName: "Guest Faculty", speakerRole: "Researcher", tags: ["data", "analytics", "ml"] },
      { title: "Hands-on Web Workshop", description: "A practical build session for HTML, CSS, React, and deployment basics.", date: addDays(2), endDate: addDays(2), venue: "Computer Lab 3", category: "Workshop", mode: "offline", status: "published", featured: false, approvalRequired: false, capacity: 60, waitlistCapacity: 0, organizerName: "Web Dev Club", tags: ["frontend", "react", "portfolio"] },
      { title: "Freshers Orientation", description: "Welcome session for new students with clubs, rules, and campus support info.", date: addDays(1), endDate: addDays(1), venue: "Open Amphitheatre", category: "General", mode: "offline", status: "upcoming", featured: true, approvalRequired: false, capacity: 1000, waitlistCapacity: 0, organizerName: "Student Council", tags: ["orientation", "students", "campus"] },
      { title: "Industry Connect Panel", description: "A dialogue with recruiters and alumni on hiring trends and career paths.", date: addDays(10), endDate: addDays(10), venue: "Virtual Townhall", category: "Placement", mode: "online", status: "published", featured: false, approvalRequired: true, capacity: 300, waitlistCapacity: 0, organizerName: "Placement Cell", tags: ["industry", "jobs", "alumni"] }
    ];

    try {
      setUploading(true);
      for (const item of templates) {
        await api.post("/api/events", {
          ...item,
          tags: item.tags.join(", "),
          certificateEnabled: true,
          certificateTemplateUrl: "",
          rules: "Follow event instructions shared by the organizer.",
        });
      }
      toast.success("Demo event set created");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Demo event creation failed");
    } finally {
      setUploading(false);
    }
  };

  const stats = useMemo(() => {
    const today = new Date();
    return {
      total: events.length,
      upcoming: events.filter((e) => new Date(e.date) >= today && e.status !== "completed" && e.status !== "cancelled").length,
      past: events.filter((e) => new Date(e.date) < today || e.status === "completed").length,
      registrations: registrations.length,
      waitlisted: registrations.filter((reg) => reg.status === "waitlisted").length,
    };
  }, [events, registrations]);

  const chartData = useMemo(() => [
    { name: "Draft", value: events.filter((e) => e.status === "draft").length },
    { name: "Published", value: events.filter((e) => e.status === "published").length },
    { name: "Upcoming", value: events.filter((e) => e.status === "upcoming").length },
    { name: "Live", value: events.filter((e) => e.status === "live").length },
    { name: "Completed", value: events.filter((e) => e.status === "completed").length },
    { name: "Cancelled", value: events.filter((e) => e.status === "cancelled").length },
  ], [events]);

  const registrationTrend = useMemo(() => (analytics?.registrationsOverTime || []).map((row) => ({
    name: `${row._id?.month || 0}/${row._id?.day || 0}`,
    registrations: row.registrations || 0,
    checkedIn: row.checkedIn || 0,
  })), [analytics]);

  const attendanceChart = useMemo(() => (analytics?.attendanceVsRegistration || []).map((row) => ({
    name: row.title,
    registrations: row.registrations || 0,
    checkedIn: row.checkedIn || 0,
    rate: row.attendanceRate || 0,
  })), [analytics]);

  const deptYearData = useMemo(() => (analytics?.participationByDepartmentYear || []).map((row) => ({
    name: `${row._id?.department || "Unknown"} / ${row._id?.year || "Unknown"}`,
    registrations: row.registrations || 0,
    checkedIn: row.checkedIn || 0,
  })), [analytics]);

  const departmentData = useMemo(() => (analytics?.registrationsByDepartment || []).map((row) => ({
    name: row._id || "Unknown",
    registrations: row.registrations || 0,
    checkedIn: row.checkedIn || 0,
  })), [analytics]);

  const yearData = useMemo(() => (analytics?.registrationsByYear || []).map((row) => ({
    name: row._id || "Unknown",
    registrations: row.registrations || 0,
    checkedIn: row.checkedIn || 0,
  })), [analytics]);

  const utilizationData = useMemo(() => (analytics?.eventCapacityUtilization || []).slice(0, 8).map((row) => ({
    name: row.title,
    utilization: row.utilization || 0,
    registrations: row.registrations || 0,
    capacity: row.capacity || 0,
  })), [analytics]);


const insightCards = useMemo(() => {
  const topEvent = (analytics?.topEvents || [])[0];
  const topDepartment = (analytics?.registrationsByDepartment || [])[0];
  const topYear = (analytics?.registrationsByYear || [])[0];
  const attendanceSignal = (analytics?.attendanceVsRegistration || []).find((item) => Number(item.checkedIn || 0) > 0) || null;

  return [
    {
      label: "Top event",
      value: topEvent?.event?.title || "No data yet",
      note: topEvent ? `${topEvent.registrations || 0} registrations` : "Open detailed analytics to review activity.",
    },
    {
      label: "Most active department",
      value: topDepartment?._id || "No data yet",
      note: topDepartment ? `${topDepartment.users || topDepartment.registrations || 0} active records` : "Department participation appears after more signups.",
    },
    {
      label: "Best year group",
      value: topYear?._id || "No data yet",
      note: topYear ? `${topYear.registrations || 0} registrations` : "Year-wise participation shows up here automatically.",
    },
    {
      label: "Attendance signal",
      value: attendanceSignal ? `${Math.round(Number(attendanceSignal.attendanceRate || 0))}%` : "0%",
      note: attendanceSignal ? `${attendanceSignal.checkedIn || 0} checked in for ${attendanceSignal.title || "an event"}` : "Check-in data appears after attendees are marked.",
    },
  ];
}, [analytics]);

  const volunteerLoadData = useMemo(() => (analytics?.volunteerLoad || []).map((row) => ({
    name: row._id || "unknown",
    value: row.value || 0,
  })), [analytics]);

  const topEventPie = useMemo(() => (analytics?.topEvents || []).map((row) => ({
    name: row.event?.title || "Event",
    value: row.registrations || 0,
  })), [analytics]);

  const filteredEvents = events.filter((event) => `${event.title} ${event.description} ${event.venue} ${event.category} ${event.subcategory}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="content-panel">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-badge">Admin console</span>
          <h1>Manage campus events without the clutter.</h1>
          <p>A focused dashboard for approvals, event creation, and simple reports.</p>
        </div>
        <div className="hero-stats">
          <div className="stat-card"><strong>{stats.total}</strong><span>Total events</span></div>
          <div className="stat-card"><strong>{stats.upcoming}</strong><span>Upcoming</span></div>
          <div className="stat-card"><strong>{stats.registrations}</strong><span>Registrations</span></div>
        </div>
      </section>

      <div className="dashboard-grid">
        <motion.section className="form-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="section-head">
            <div><h2>{editingId ? "Edit Event" : "Create Event"}</h2><p className="muted">Add a new event to the portal.</p></div>
            <div className="section-icon"><FaPlus /></div>
          </div>
          <div className="field-grid">
            <input value={form.title} onChange={(e) => updateField("title", e.target.value)} placeholder="Event title" />
            <input value={form.venue} onChange={(e) => updateField("venue", e.target.value)} placeholder="Venue" />
          </div>
          <div className="field-grid three">
            <input value={form.category} onChange={(e) => updateField("category", e.target.value)} placeholder="Category" />
            <input value={form.subcategory} onChange={(e) => updateField("subcategory", e.target.value)} placeholder="Subcategory" />
            <select value={form.mode} onChange={(e) => updateField("mode", e.target.value)}><option value="offline">Offline</option><option value="online">Online</option><option value="hybrid">Hybrid</option></select>
          </div>
          <div className="field-grid three">
            <select value={form.status} onChange={(e) => updateField("status", e.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
            <input type="number" min="0" value={form.capacity} onChange={(e) => updateField("capacity", e.target.value)} placeholder="Capacity" />
            <input type="number" min="0" value={form.waitlistCapacity} onChange={(e) => updateField("waitlistCapacity", e.target.value)} placeholder="Waitlist limit" />
          </div>
          <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="Event description" rows="5" />
          <div className="field-grid two"><input type="date" value={form.date} onChange={(e) => updateField("date", e.target.value)} /><input type="date" value={form.endDate} onChange={(e) => updateField("endDate", e.target.value)} /></div>
          <div className="field-grid two"><input value={form.organizerName} onChange={(e) => updateField("organizerName", e.target.value)} placeholder="Organizer name" /><input value={form.speakerName} onChange={(e) => updateField("speakerName", e.target.value)} placeholder="Speaker name" /></div>
          <div className="field-grid two"><input value={form.speakerRole} onChange={(e) => updateField("speakerRole", e.target.value)} placeholder="Speaker role" /><input value={form.schedule} onChange={(e) => updateField("schedule", e.target.value)} placeholder="Schedule summary" /></div>
          <div className="field-grid two"><input value={form.tags} onChange={(e) => updateField("tags", e.target.value)} placeholder="Tags comma separated" /><input value={form.attachments} onChange={(e) => updateField("attachments", e.target.value)} placeholder="Attachments comma separated" /></div>
          <input value={form.certificateTemplateUrl} onChange={(e) => updateField("certificateTemplateUrl", e.target.value)} placeholder="Certificate template URL" />
          <div className="field-grid two"><input value={form.imageUrl} onChange={(e) => updateField("imageUrl", e.target.value)} placeholder="Poster image URL" /><input value={form.locationUrl} onChange={(e) => updateField("locationUrl", e.target.value)} placeholder="Location URL" /></div>
          <div className="field-grid two">
            <label className="upload-chip">Upload poster<input type="file" accept="image/*" onChange={(e) => uploadAsset(e.target.files?.[0], "imageUrl")} /></label>
            <label className="upload-chip">Upload certificate<input type="file" accept="image/*" onChange={(e) => uploadAsset(e.target.files?.[0], "certificateTemplateUrl")} /></label>
          </div>
          <textarea value={form.rules} onChange={(e) => updateField("rules", e.target.value)} placeholder="Event rules / instructions" rows="3" />
          <div className="toggle-row"><label className="toggle-pill"><input type="checkbox" checked={form.featured} onChange={(e) => updateField("featured", e.target.checked)} /> Featured</label><label className="toggle-pill"><input type="checkbox" checked={form.approvalRequired} onChange={(e) => updateField("approvalRequired", e.target.checked)} /> Approval required</label><label className="toggle-pill"><input type="checkbox" checked={form.certificateEnabled} onChange={(e) => updateField("certificateEnabled", e.target.checked)} /> Certificates</label></div>
          <div className="button-row"><button className="primary-btn full" onClick={handleSubmit} type="button" disabled={uploading}>{uploading ? "Uploading..." : (editingId ? "Update Event" : "Create Event")}</button>{editingId && <button className="secondary-btn" type="button" onClick={resetForm}>Cancel</button>}</div>
        </motion.section>

        <section className="chart-card">
          <div className="section-head"><div><h2>Analytics snapshot</h2><p className="muted">Quick view of event status distribution.</p></div><div className="section-icon"><FaChartBar /></div></div>
          <div className="chart-wrap"><ResponsiveContainer width="100%" height={260}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" /></BarChart></ResponsiveContainer></div>
          <div className="mini-stats"><div className="mini-card"><FaCalendarAlt /><strong>{stats.past}</strong><span>Past events</span></div><div className="mini-card"><FaUsers /><strong>{stats.waitlisted}</strong><span>Waitlisted</span></div><div className="mini-card"><FaTicketAlt /><strong>{stats.registrations}</strong><span>Total regs</span></div></div>
          {dashboardStats?.roleBreakdown && (
            <div className="mini-report">
              <p className="detail-label">Role breakdown</p>
              <div className="tag-row">{dashboardStats.roleBreakdown.map((item) => <span key={item._id} className="mini-tag">{item._id}: {item.value}</span>)}</div>
            </div>
          )}
        </section>
      </div>


<section className="card-surface" style={{ marginTop: 24 }}>
  <div className="section-head compact">
    <div>
      <h2>Insights at a glance</h2>
      <p className="muted">A short summary that is easy to explain during viva.</p>
    </div>
    <div className="section-icon"><FaChartBar /></div>
  </div>
  <div className="insight-grid">
    {insightCards.map((item) => (
      <div key={item.label} className="insight-card">
        <span className="detail-label">{item.label}</span>
        <strong>{item.value}</strong>
        <p className="muted">{item.note}</p>
      </div>
    ))}
  </div>
</section>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="section-head compact"><div><h2>Pending approvals</h2><p className="muted">Draft or approval-required events waiting for action.</p></div><div className="section-icon"><FaCheckCircle /></div></div>
        <div className="event-grid admin-event-grid">
          {pendingEvents.length === 0 ? <div className="empty-state"><p>No pending approvals right now.</p></div> : pendingEvents.slice(0, 6).map((event) => (<motion.article key={event._id} className="event-card admin-event-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><div className="event-top"><span className="event-tag">{event.approvalRequired ? "Approval required" : "Draft"}</span><span className="event-date status-draft">{event.status || "draft"}</span></div><h3>{event.title}</h3><p className="clamp-3">{event.description}</p><div className="event-meta"><span>📍 {event.venue}</span><span>📅 {new Date(event.date).toLocaleDateString()}</span></div><div className="card-actions"><button className="icon-btn edit" type="button" onClick={() => handleApprove(event._id)}><FaCheckCircle /> Approve</button><button className="icon-btn edit" type="button" onClick={() => handlePublish(event._id)}><FaPaperPlane /> Publish</button><button className="icon-btn delete" type="button" onClick={() => handleDelete(event._id)}><FaArchive /> Archive</button></div></motion.article>))}
        </div>
      </section>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="section-head compact"><div><h2>Reports</h2><p className="muted">Top events and department participation.</p></div><div className="section-icon"><FaClipboardList /></div></div>
        <div className="admin-actions-row">
          <button className="secondary-btn" type="button" onClick={() => downloadExport("events")}><FaFileExport /> Events CSV</button>
          <button className="secondary-btn" type="button" onClick={() => downloadExport("registrations")}><FaFileExport /> Registrations CSV</button>
          <button className="secondary-btn" type="button" onClick={() => downloadExport("users")}><FaFileExport /> Users CSV</button>
          <button className="secondary-btn" type="button" onClick={() => downloadExport("feedback")}><FaFileExport /> Feedback CSV</button>
          <button className="secondary-btn" type="button" onClick={() => downloadExport("logs")}><FaFileExport /> Logs CSV</button>
          <button className="secondary-btn" type="button" onClick={() => downloadExport("announcements")}><FaFileExport /> Announcements CSV</button>
          <button className="secondary-btn" type="button" onClick={() => downloadExport("notifications")}><FaFileExport /> Notifications CSV</button>
          <button className="secondary-btn" type="button" onClick={() => downloadExport("volunteers")}><FaFileExport /> Volunteers CSV</button>
          <button className="secondary-btn" type="button" onClick={() => downloadReportsExport("csv")}><FaFileExport /> Reports CSV</button>
          <button className="secondary-btn" type="button" onClick={() => downloadReportsExport("json")}><FaFileExport /> Reports JSON</button>
        </div>
        <div className="dashboard-grid reports-grid">
          <div className="report-box">
            <p className="detail-label">Top events</p>
            {(reports?.topEvents || []).map((item, index) => <div key={item.event?._id || index} className="report-row"><strong>{item.event?.title || "Event"}</strong><span>{item.registrations} regs • {item.checkedIn} checked in</span></div>)}
          </div>
          <div className="report-box">
            <p className="detail-label">Users by department</p>
            {(reports?.byDepartment || []).map((item) => <div key={item._id} className="report-row"><strong>{item._id}</strong><span>{item.users} users</span></div>)}
          </div>
        </div>
      </section>
      <details className="card-surface advanced-fold">
        <summary className="advanced-summary">
          <div>
            <h2>Sample data</h2>
            <p className="muted">Optional one-click demo content for testing.</p>
          </div>
          <span className="summary-hint">Tap to expand</span>
        </summary>
        <div className="advanced-fold-body">
          <div className="section-head compact">
            <div>
              <h3>Demo event library</h3>
              <p className="muted">Create a full spread of campus event types in one click for testing and demos.</p>
            </div>
            <div className="section-icon"><FaCalendarAlt /></div>
          </div>
          <div className="button-row">
          <button className="primary-btn" type="button" onClick={seedDemoEvents} disabled={uploading}>
            {uploading ? "Creating demo set..." : "Create all demo events"}
          </button>
          <button className="secondary-btn" type="button" onClick={() => fetchData()}>
            Refresh lists
          </button>
          </div>
        </div>
      </details>
      <details className="card-surface advanced-fold">
        <summary className="advanced-summary">
          <div>
            <h2>Detailed analytics</h2>
            <p className="muted">Expanded charts for reports and viva demonstration.</p>
          </div>
          <span className="summary-hint">Tap to expand</span>
        </summary>
        <div className="advanced-fold-body">
          <div className="section-head compact">
            <div>
              <h3>Advanced analytics</h3>
              <p className="muted">Registrations over time, top events, department/year mix, attendance, and capacity usage.</p>
            </div>
            <div className="section-icon"><FaChartBar /></div>
          </div>
          <div className="admin-actions-row" style={{ marginTop: 12 }}>
          <select value={analyticsRange} onChange={(e) => setAnalyticsRange(e.target.value)} style={{ minWidth: 180 }}>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 180 days</option>
            <option value="365">Last 365 days</option>
          </select>
          <span className="muted">Range updates automatically.</span>
        </div>
        <div className="dashboard-grid reports-grid">
          <div className="chart-card">
            <p className="detail-label">Registrations over time</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={registrationTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="registrations" />
                <Line type="monotone" dataKey="checkedIn" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-card">
            <p className="detail-label">Top events</p>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={topEventPie} dataKey="value" nameKey="name" outerRadius={90} label />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="dashboard-grid reports-grid" style={{ marginTop: 16 }}>
          <div className="chart-card">
            <p className="detail-label">Participation by department / year</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={deptYearData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="registrations" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-card">
            <p className="detail-label">Attendance vs registration</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={attendanceChart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="registrations" />
                <Bar dataKey="checkedIn" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="dashboard-grid reports-grid" style={{ marginTop: 16 }}>
          <div className="chart-card">
            <p className="detail-label">Department totals</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={departmentData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="registrations" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-card">
            <p className="detail-label">Capacity utilization</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={utilizationData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="utilization" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="dashboard-grid reports-grid" style={{ marginTop: 16 }}>
          <div className="chart-card">
            <p className="detail-label">Volunteer task status</p>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={volunteerLoadData} dataKey="value" nameKey="name" outerRadius={90} label />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-card">
            <p className="detail-label">Year totals</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={yearData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="registrations" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        </div>
      </details>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="section-head compact"><div><h2>Manage Events</h2><p className="muted">Search, edit, and archive.</p></div><div className="search-wrap"><FaSearch /><input type="text" placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
        {loading ? <div className="skeleton-grid">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton-card" />)}</div> : <div className="event-grid admin-event-grid">{filteredEvents.length === 0 ? <div className="empty-state"><p>No matching events found.</p></div> : filteredEvents.map((event, index) => (<motion.article key={event._id} className="event-card admin-event-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} whileHover={{ y: -6 }}><div className="event-top"><span className="event-tag">{event.featured ? "Featured" : event.category || "Campus Event"}</span><span className={`event-date status-${event.status || "upcoming"}`}>{event.status || "upcoming"}</span></div><h3>{event.title}</h3><p className="clamp-3">{event.description}</p><div className="event-meta"><span>📍 {event.venue}</span><span>📅 {new Date(event.date).toLocaleDateString()}</span></div><div className="meta-row"><span className="badge-pill">Views {event.views || 0}</span><span className="badge-pill subtle">{event.mode || "offline"}</span><span className="badge-pill subtle">{event.capacity ?? "Open"}</span></div><div className="card-actions"><button className="icon-btn edit" onClick={() => handleEdit(event)} type="button"><FaEdit /> Edit</button><button className="icon-btn delete" onClick={() => handleDelete(event._id)} type="button"><FaTrash /> Archive</button></div></motion.article>))}</div>}
      </section>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="section-head compact"><div><h2>Registrations</h2><p className="muted">Attendance and check-in.</p></div></div>
        {loading ? <div className="skeleton-grid">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton-card" />)}</div> : <div className="table-card">{registrations.length === 0 ? <div className="empty-state"><p>No registrations yet.</p></div> : registrations.slice(0, 12).map((reg) => (<div key={reg._id} className="table-row"><div><strong>{reg.user?.name || "Unknown"}</strong><p className="muted">{reg.user?.email || ""}</p></div><div><strong>{reg.event?.title || "Event"}</strong><p className="muted">{reg.event?.category || ""}</p></div><div><span className={`event-date status-${reg.status || "confirmed"}`}>{reg.status || "confirmed"}</span></div><button className="secondary-btn tiny" type="button" onClick={() => handleCheckIn(reg._id)} disabled={reg.checkedIn}>{reg.checkedIn ? "Checked in" : "Mark check-in"}</button></div>))}</div>}
      </section>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="section-head compact"><div><h2>Users & roles</h2><p className="muted">Grant student, coordinator, volunteer, or admin access.</p></div><div className="section-icon"><FaUserShield /></div></div>
        <div className="table-card">
          {users.map((item) => (
            <div key={item._id} className="table-row">
              <div><strong>{item.name}</strong><p className="muted">{item.email}</p></div>
              <div><span className="badge-pill">{item.department || "—"}</span></div>
              <div><span className="badge-pill subtle">{item.year || "—"}</span></div>
              <select value={item.role} onChange={(e) => updateRole(item._id, e.target.value)} className="role-select">
                <option value="student">student</option>
                <option value="coordinator">coordinator</option>
                <option value="volunteer">volunteer</option>
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
              </select>
            </div>
          ))}
        </div>
      </section>

      {dashboardStats && <section className="mini-report card-surface" style={{ marginTop: 24 }}><div className="section-head compact"><div><h2>Admin summary</h2><p className="muted">Live metrics from the admin endpoint.</p></div></div><div className="mini-stats"><div className="mini-card"><strong>{dashboardStats.totalUsers}</strong><span>Users</span></div><div className="mini-card"><strong>{dashboardStats.totalEvents}</strong><span>Events</span></div><div className="mini-card"><strong>{dashboardStats.archivedEvents}</strong><span>Archived</span></div></div></section>}
    </div>
  );
}
