import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout({ children }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const openSidebar = () => setMobileSidebarOpen(true);
  const closeSidebar = () => setMobileSidebarOpen(false);

  return (
    <div className={`app-shell ${mobileSidebarOpen ? "sidebar-open" : ""}`}>
      <Sidebar mobileOpen={mobileSidebarOpen} onClose={closeSidebar} />
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Close navigation"
        onClick={closeSidebar}
      />
      <div className="app-main">
        <Topbar onMenuClick={openSidebar} />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
