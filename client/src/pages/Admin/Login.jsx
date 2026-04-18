import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../../lib/api.js";

const Login = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    portal: "admin",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const response = await authAPI.login(formData.email, formData.password);
      const { token, user } = response.data.data;

      if (formData.portal === "admin" && user.role === "faculty") {
        setError("Please login using Faculty portal");
        return;
      }

      if (formData.portal === "faculty" && user.role !== "faculty") {
        setError("This account is not a faculty account");
        return;
      }

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      if (user.mustChangePassword) {
        navigate("/admin/change-password");
        return;
      }

      if (user.role === "faculty") {
        navigate(`/admin/people/${user.facultyProfileId}`);
      } else {
        navigate("/admin");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-4 shadow-md">
              LN
            </div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Portal Login
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Admin & Faculty Access
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Portal */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Login As
              </label>
              <select
                name="portal"
                value={formData.portal}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              >
                <option value="admin">Admin</option>
                <option value="faculty">Faculty</option>
              </select>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="Enter your email"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter your password"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            {/* 🔥 BUTTON (FIXED PROPERLY) */}
            <button
              type="submit"
              disabled={loading}
              className="
                w-full rounded-lg px-4 py-3 font-semibold text-white
                bg-gradient-to-r from-red-600 to-red-700
                shadow-md shadow-red-200
                hover:from-red-700 hover:to-red-800
                hover:shadow-lg hover:-translate-y-[1px]
                active:translate-y-[0px] active:shadow-sm
                transition-all duration-200
                disabled:opacity-60 disabled:cursor-not-allowed
              "
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;