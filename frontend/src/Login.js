import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  FaCheckCircle,
  FaCompass,
  FaEye,
  FaEyeSlash,
  FaShieldAlt,
  FaSignInAlt,
} from "react-icons/fa";
import { useAuth } from "./context/AuthContext";
import api from "./lib/api";

const benefits = [
  "One obvious path for guests, students, and returning users",
  "Less visual clutter and more breathing room on every form",
  "Clearer action hierarchy across the whole portal",
];

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  useEffect(() => {
    const prefillEmail = location.state?.prefillEmail;
    if (prefillEmail) setEmail(prefillEmail);
  }, [location.state]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/api/auth/login", {
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });
      login(res.data);
      toast.success("Welcome back!");
      navigate("/events", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-shell">
      <motion.aside className="auth-aside card-surface" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="section-head compact">
          <div>
            <span className="hero-badge">Guest access</span>
            <h2>Everything is one step away.</h2>
            <p className="muted">Sign in for your dashboard, or continue as a guest to browse events first.</p>
          </div>
          <div className="section-icon"><FaCompass /></div>
        </div>
        <div className="promo-list">
          {benefits.map((item) => (
            <div key={item} className="promo-item">
              <FaCheckCircle />
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div className="auth-note">
          <FaShieldAlt />
          <span>Demo accounts are pre-verified, so you can log in without any email steps.</span>
        </div>
        <div className="auth-mini-actions">
          <Link className="secondary-btn full" to="/events">Explore as guest</Link>
          <Link className="secondary-btn full" to="/register">Create a new account</Link>
        </div>
      </motion.aside>

      <motion.form onSubmit={handleLogin} className="auth-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="auth-header">
          <span className="hero-badge">Welcome back</span>
          <h1>Login to CampusConnect</h1>
          <p>Manage registrations, explore events, and access your dashboard in one place.</p>
        </div>
        <div className="auth-form">
          <label>
            Email
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label>
            Password
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </label>
          <button className="primary-btn full" type="submit" disabled={loading}>{loading ? "Logging in..." : <><FaSignInAlt /> Login</>}</button>
        </div>
        <div className="auth-help auth-help-stack">
          <p>New here? <Link to="/register">Create an account</Link></p>
        </div>
      </motion.form>
    </div>
  );
}

export default Login;
