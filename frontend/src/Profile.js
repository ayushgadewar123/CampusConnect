import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FaDownload, FaSignOutAlt } from "react-icons/fa";
import api from "./lib/api";
import { useAuth } from "./context/AuthContext";

const splitList = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
const isAdminRole = (role) => ["admin", "super_admin"].includes(String(role || "").toLowerCase());

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBA";
  return date.toLocaleDateString();
};

export default function Profile() {
  const { user, login } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [ownedEvents, setOwnedEvents] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [achievements, setAchievements] = useState({ badges: [], points: 0, stats: {} });
  const [form, setForm] = useState({ name: "", department: "", year: "", phone: "", bio: "", profileImage: "", interests: "", skills: "" });

  const currentRole = String(stats?.user?.role || user?.role || "").toLowerCase();
  const adminMode = isAdminRole(currentRole);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [
        api.get("/api/auth/me"),
        api.get("/api/dashboard"),
        api.get("/api/dashboard/certificates"),
        api.get("/api/dashboard/achievements"),
      ];

      if (isAdminRole(user?.role)) {
        requests.push(api.get("/api/events"));
      }

      const responses = await Promise.all(requests);
      const [meRes, dashboardRes, certRes, achRes, eventsRes] = responses;
      const profile = meRes.data?.user || user || {};

      setForm({
        name: profile.name || "",
        department: profile.department || "",
        year: profile.year || "",
        phone: profile.phone || "",
        bio: profile.bio || "",
        profileImage: profile.profileImage || "",
        interests: (profile.interests || []).join(", "),
        skills: (profile.skills || []).join(", "),
      });

      setStats(dashboardRes.data || null);
      setCertificates(Array.isArray(certRes.data?.certificates) ? certRes.data.certificates : []);
      setAchievements(achRes.data || { badges: [], points: 0, stats: {} });

      if (isAdminRole(profile.role || user?.role)) {
        const allEvents = Array.isArray(eventsRes?.data)
          ? eventsRes.data
          : Array.isArray(eventsRes?.data?.events)
            ? eventsRes.data.events
            : [];
        const profileId = String(profile._id || user?._id || "");
        const mine = allEvents.filter((event) => String(event?.createdBy?._id || event?.createdBy || "") === profileId);
        setOwnedEvents(mine);
        setHistory(mine.slice(0, 8));
      } else {
        setOwnedEvents([]);
        setHistory(Array.isArray(dashboardRes.data?.myRegistrations) ? dashboardRes.data.myRegistrations : []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const signOutAllDevices = async () => {
    try {
      await api.post("/api/auth/logout-all");
    } catch (error) {
      // ignore backend errors and still clear the local session
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("auth:logout"));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.patch("/api/auth/me", { ...form, interests: splitList(form.interests), skills: splitList(form.skills) });
      if (res.data?.user) login({ token: localStorage.getItem("token"), user: res.data.user });
      toast.success("Profile updated");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const downloadSummary = async () => {
    try {
      if (adminMode) {
        const res = await api.get("/api/dashboard");
        const data = res.data || {};
        const lines = [
          `Name: ${data.user?.name || user?.name || ""}`,
          `Email: ${data.user?.email || user?.email || ""}`,
          `Role: ${data.user?.role || user?.role || ""}`,
          `Total Users: ${data.stats?.totalUsers ?? 0}`,
          `Total Events: ${data.stats?.totalEvents ?? 0}`,
          `Total Registrations: ${data.stats?.totalRegistrations ?? 0}`,
          `Upcoming Events: ${data.stats?.upcomingEvents ?? 0}`,
          `Live Events: ${data.stats?.liveEvents ?? 0}`,
          `Waitlisted Registrations: ${data.stats?.waitlistedRegistrations ?? 0}`,
          `Created Events: ${ownedEvents.length}`,
          "",
          "Created Events:",
          ...ownedEvents.slice(0, 10).map((event) => `- ${event.title} (${formatDate(event.date)}) • ${event.status || "draft"} • ${event.venue || "TBA"}`),
        ];
        const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "campusconnect-admin-summary.txt";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Summary downloaded");
        return;
      }

      const res = await api.get("/api/dashboard/resume");
      const data = res.data || {};
      const lines = [
        `Name: ${data.profile?.name || ""}`,
        `Email: ${data.profile?.email || ""}`,
        `Department: ${data.profile?.department || ""}`,
        `Year: ${data.profile?.year || ""}`,
        `Points: ${(data.profile?.badges || []).length * 10 + (data.stats?.completed || 0) * 20}`,
        `Total Events: ${data.stats?.total ?? 0}`,
        `Completed Events: ${data.stats?.completed ?? 0}`,
        `Checked In: ${data.stats?.checkedIn ?? 0}`,
        `Waitlisted: ${data.stats?.waitlisted ?? 0}`,
        `Interests: ${(data.profile?.interests || []).join(", ")}`,
        `Skills: ${(data.profile?.skills || []).join(", ")}`,
        "",
        "Certificates:",
        ...(data.certificates || []).map((cert) => `- ${cert.title} (${cert.certificateCode})`),
        "",
        "Feedback:",
        ...(data.feedback || []).map((item) => `- ${item.event?.title || "Event"}: ${item.rating}/5`),
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "campusconnect-resume.txt";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Resume downloaded");
    } catch (error) {
      toast.error(error.response?.data?.message || "Summary export failed");
    }
  };

  const summary = useMemo(() => {
    const s = stats?.stats || {};
    if (adminMode) {
      return [
        { label: "Created", value: ownedEvents.length },
        { label: "Registrations", value: s.totalRegistrations ?? 0 },
        { label: "Upcoming", value: s.upcomingEvents ?? 0 },
        { label: "Live", value: s.liveEvents ?? 0 },
        { label: "Users", value: s.totalUsers ?? 0 },
        { label: "Waitlist", value: s.waitlistedRegistrations ?? 0 },
      ];
    }
    return [
      { label: "Registered", value: s.registeredEvents ?? 0 },
      { label: "Confirmed", value: s.confirmed ?? 0 },
      { label: "Waitlisted", value: s.waitlisted ?? 0 },
      { label: "Upcoming", value: s.upcoming ?? 0 },
      { label: "Completed", value: s.completedEvents ?? 0 },
      { label: "Checked in", value: s.checkedIn ?? 0 },
    ];
  }, [stats, adminMode, ownedEvents.length]);

  const activityItems = adminMode ? ownedEvents : history;
  const hasActivity = activityItems.length > 0;
  const heroTitle = adminMode
    ? "Track campus operations and event ownership in one place."
    : "Keep your campus identity, skills, and activity in one place.";
  const heroDescription = adminMode
    ? "See the events you created, the overall participation on campus, and the live status of your dashboard at a glance."
    : "Update your profile to improve recommendations and keep your long-term record accurate.";
  const heroBadge = adminMode ? "Admin overview" : "My profile";

  return (
    <div className="content-panel">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-badge">{heroBadge}</span>
          <h1>{heroTitle}</h1>
          <p>{heroDescription}</p>
        </div>
        <div className="hero-stats">
          <div className="stat-card"><strong>{achievements.points || 0}</strong><span>Points</span></div>
          <div className="stat-card"><strong>{(achievements.badges || []).length}</strong><span>Badges</span></div>
        </div>
        <div className="hero-actions profile-hero-actions">
          <button className="secondary-btn" type="button" onClick={downloadSummary}><FaDownload /> {adminMode ? "Export summary" : "Resume"}</button>
          <button className="secondary-btn" type="button" onClick={signOutAllDevices}><FaSignOutAlt /> Sign out all</button>
        </div>
      </section>

      {loading ? (
        <div className="empty-state"><p>Loading profile...</p></div>
      ) : (
        <div className="dashboard-grid">
          <motion.section className="form-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="section-head">
              <div>
                <h2>Profile editor</h2>
                <p className="muted">{adminMode ? "Keep your admin identity and contact info current." : "Use this to keep your long-term campus record fresh."}</p>
              </div>
            </div>
            <div className="field-grid two"><input value={form.name} onChange={(e) => handleChange("name", e.target.value)} placeholder="Name" /><input value={form.department} onChange={(e) => handleChange("department", e.target.value)} placeholder="Department" /></div>
            <div className="field-grid two"><input value={form.year} onChange={(e) => handleChange("year", e.target.value)} placeholder="Year / Semester" /><input value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="Phone" /></div>
            <input value={form.profileImage} onChange={(e) => handleChange("profileImage", e.target.value)} placeholder="Profile image URL" />
            <textarea rows="4" value={form.bio} onChange={(e) => handleChange("bio", e.target.value)} placeholder="Short bio" />
            <input value={form.interests} onChange={(e) => handleChange("interests", e.target.value)} placeholder="Interests comma separated" />
            <input value={form.skills} onChange={(e) => handleChange("skills", e.target.value)} placeholder="Skills comma separated" />
            <div className="card-actions wrap">
              <button className="primary-btn" type="button" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save profile"}</button>
            </div>
          </motion.section>

          <section className="chart-card">
            <div className="section-head">
              <div>
                <h2>{adminMode ? "Operations snapshot" : "Activity snapshot"}</h2>
                <p className="muted">{adminMode ? "A quick view of the campus events you own." : "A quick view of your participation."}</p>
              </div>
            </div>
            <div className="mini-stats">{summary.map((item) => <div key={item.label} className="mini-card"><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>
            <div className="mini-report">
              <p className="detail-label">{adminMode ? "Managed events" : "Points"}</p>
              <strong style={{ fontSize: 28 }}>{adminMode ? ownedEvents.length : (achievements.points || 0)}</strong>
            </div>
            <div className="profile-summary">
              <div>
                <p className="detail-label">Interests</p>
                <div className="tag-row">{(form.interests ? splitList(form.interests) : []).map((item) => <span key={item} className="mini-tag">{item}</span>)}</div>
              </div>
              <div>
                <p className="detail-label">Skills</p>
                <div className="tag-row">{(form.skills ? splitList(form.skills) : []).map((item) => <span key={item} className="mini-tag">{item}</span>)}</div>
              </div>
              <div>
                <p className="detail-label">{adminMode ? "Owned events" : "Certificates"}</p>
                <div className="tag-row">
                  {(adminMode ? ownedEvents.slice(0, 6) : certificates.slice(0, 6)).map((item) => (
                    <span key={item._id || item.id || item.title} className="mini-tag">
                      {item.title}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="detail-label">{adminMode ? "Latest status" : "Achievements"}</p>
                <div className="tag-row">
                  {(adminMode ? ownedEvents.slice(0, 6) : (achievements.badges || []).slice(0, 6)).map((item) => (
                    <span key={item._id || item.id || item.label} className="mini-tag">
                      {adminMode ? `${item.status || "draft"} • ${formatDate(item.date)}` : item.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="section-head compact">
          <div>
            <h2>{adminMode ? "Recent managed events" : "Recent activity"}</h2>
            <p className="muted">{adminMode ? "The newest events you created or edited." : "A simple archive of your campus participation."}</p>
          </div>
        </div>

        {hasActivity ? (
          <div className="timeline-list">
            {activityItems.slice(0, 8).map((item) => (
              <div key={item._id} className="timeline-item">
                <strong>{adminMode ? item.title || "Event" : item.event?.title || "Event"}</strong>
                <span>
                  {adminMode
                    ? `${item.status || "draft"} • ${item.category || "General"} • ${formatDate(item.date)} • ${item.venue || "TBA"}`
                    : `${item.status} • ${item.event?.category || "General"} • ${item.event?.status || "upcoming"}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>{adminMode ? "No created events yet." : "No recent activity yet."}</p>
          </div>
        )}
      </section>
    </div>
  );
}
