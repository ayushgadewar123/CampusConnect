import { Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

function Navbar() {
  const { user, logout } = useAuth();

  return (
    <div className="flex justify-between p-4 bg-black text-white">
      <div className="space-x-4">
        <Link to="/home">Home</Link>
        <Link to="/events">Events</Link>

        {user && <Link to="/my-registrations">My Registrations</Link>}

        {['admin', 'super_admin'].includes(user?.role) && (
          <Link to="/admin">Admin</Link>
        )}
      </div>

      <div>
        {user ? (
          <button onClick={logout}>Logout</button>
        ) : (
          <Link to="/login">Login</Link>
        )}
      </div>
    </div>
  );
}

export default Navbar;
