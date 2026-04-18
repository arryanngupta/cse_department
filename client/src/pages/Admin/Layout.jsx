import { useState, useEffect, useMemo } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { authAPI } from "../../lib/api.js";

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await authAPI.getMe();
        const me = response.data.data;
        setUser(me);

        if (me?.role === "faculty") {
          if (me.mustChangePassword) {
            if (location.pathname !== "/admin/change-password") {
              navigate("/admin/change-password", { replace: true });
            }
            return;
          }

          const allowedPath = me.facultyProfileId
            ? `/admin/people/${me.facultyProfileId}`
            : "/admin";

          const isDashboard = location.pathname === "/admin";
          const isAllowedProfile =
            location.pathname === allowedPath ||
            location.pathname.startsWith(`${allowedPath}/`);

          if (location.pathname === "/admin/people") {
            navigate(allowedPath, { replace: true });
            return;
          }

          if (
            location.pathname.startsWith("/admin") &&
            !isDashboard &&
            !isAllowedProfile
          ) {
            navigate(allowedPath, { replace: true });
          }
        }
      } catch (error) {
        navigate("/admin/login");
      }
    };

    checkAuth();
  }, [navigate, location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/admin/login");
  };

  const isActive = (path) => location.pathname === path;

  const menuItems = useMemo(() => {
    const baseItems = [{ path: "/admin", label: "Dashboard", icon: "📊" }];

    if (user?.role === "faculty") {
      return [
        ...baseItems,
        {
          path: user.facultyProfileId
            ? `/admin/people/${user.facultyProfileId}`
            : "/admin/people",
          label: "Edit My Profile",
          icon: "👤",
        },
      ];
    }

    return [
      ...baseItems,
      { path: "/admin/sliders", label: "Hero Sliders", icon: "🖼️" },
      { path: "/admin/people", label: "Faculty", icon: "👥" },
      { path: "/admin/programs", label: "Programs", icon: "📚" },
      { path: "/admin/news", label: "News", icon: "📰" },
      { path: "/admin/events", label: "Events", icon: "📅" },
      { path: "/admin/achievements", label: "Achievements", icon: "🏆" },
      { path: "/admin/newsletters", label: "Newsletters", icon: "📄" },
      { path: "/admin/directory", label: "Directory", icon: "📞" },
      { path: "/admin/info-blocks", label: "Info Blocks", icon: "📝" },
      { path: "/admin/research", label: "Research", icon: "🔬" },
      { path: "/admin/facilities", label: "Facilities", icon: "🏢" },
      { path: "/admin/opportunities", label: "Opportunities", icon: "💼" },
    ];
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full w-12 h-12 border-b-2 border-lnmiit-red"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-md fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-md hover:bg-gray-100"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-lnmiit-red">
              LNMIIT CSE Admin
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-gray-700">
              Welcome, {user.name} {user.role ? `(${user.role})` : ""}
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        <aside
          className={`bg-white w-64 h-[calc(100vh-4rem)] lg:h-auto shadow-md fixed lg:static top-16 lg:top-0 left-0 transform ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 transition-transform duration-200 ease-in-out z-30 overflow-y-auto border-r`}
        >
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`relative flex items-center px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
                  isActive(item.path)
                    ? "bg-[#A6192E]/10 text-[#A6192E] font-semibold before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-[#A6192E]"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default Layout;
