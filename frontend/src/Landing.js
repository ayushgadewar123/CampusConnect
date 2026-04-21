import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaArrowRight, FaCalendarAlt, FaSignInAlt, FaUserPlus, FaCompass, FaShieldAlt, FaUsers, FaBullhorn, FaCheckCircle } from "react-icons/fa";
import { useAuth } from "./context/AuthContext";

const featureCards = [
  {
    icon: FaCalendarAlt,
    title: "Event browsing",
    text: "Students can quickly scan upcoming college events with the most useful details shown first.",
  },
  {
    icon: FaUsers,
    title: "Simple registration",
    text: "A clear register button keeps the demo easy to explain while still feeling polished.",
  },
  {
    icon: FaBullhorn,
    title: "Campus notices",
    text: "Announcements stay in one place so the portal feels organized instead of scattered.",
  },
];

const highlights = [
  "Built for a safer college demo",
  "Admin, student, and coordinator roles",
  "Responsive and presentation-friendly",
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <section className="hero-card landing-hero">
        <motion.div className="hero-copy" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <span className="hero-badge">CampusConnect</span>
          <h1>A cleaner portal for campus events, registrations, and notices.</h1>
          <p>
            The interface stays polished, but the flow stays simple, safe, and easy to explain.
          </p>

          <div className="button-row hero-actions">
            <Link className="primary-btn" to="/register">
              <FaUserPlus /> Join now
            </Link>
            <Link className="secondary-btn" to="/login">
              <FaSignInAlt /> Sign in
            </Link>
            <Link className="secondary-btn" to="/events">
              <FaCompass /> Explore events
            </Link>
          </div>

          <div className="landing-highlight-row">
            {highlights.map((item) => (
              <span key={item} className="landing-highlight">
                <FaCheckCircle />
                {item}
              </span>
            ))}
          </div>

          {user && (
            <div className="landing-note">
              <FaShieldAlt />
              <span>You are already signed in. Your dashboard is ready.</span>
              <button className="secondary-btn tiny" type="button" onClick={() => navigate("/home")}>
                Open dashboard <FaArrowRight />
              </button>
            </div>
          )}
        </motion.div>

        <motion.div className="landing-panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="landing-panel-head">
            <div>
              <p className="eyebrow">Project overview</p>
              <h2>Focused, readable, and presentation-friendly.</h2>
            </div>
            <div className="section-icon"><FaCompass /></div>
          </div>

          <div className="landing-mini-grid">
            <div className="mini-card">
              <strong>Admin</strong>
              <span>Create and manage events</span>
            </div>
            <div className="mini-card">
              <strong>Student</strong>
              <span>Browse and register quickly</span>
            </div>
            <div className="mini-card">
              <strong>Notices</strong>
              <span>Share updates in one place</span>
            </div>
          </div>

          <div className="landing-tip">
            <p className="detail-label">What this project covers</p>
            <ul>
              <li>Authentication for students and admin users.</li>
              <li>Event listing, event details, and registration flow.</li>
              <li>Announcements, profile, and saved events.</li>
            </ul>
          </div>
        </motion.div>
      </section>

      <section className="landing-feature-grid">
        {featureCards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.article key={card.title} className="landing-feature card-surface" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="section-icon"><Icon /></div>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </motion.article>
          );
        })}
      </section>
    </div>
  );
}
