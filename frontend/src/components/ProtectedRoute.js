import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, adminOnly = false, allowedRoles = null }) => {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <div className="page-spinner">
        <div className="spinner" />
        <p>Checking session...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (adminOnly && !["admin", "super_admin"].includes(user.role)) {
    return <Navigate to="/events" replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/events" replace />;
  }

  return children;
};

export default ProtectedRoute;
