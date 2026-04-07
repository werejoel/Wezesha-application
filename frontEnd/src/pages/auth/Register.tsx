import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register, getCurrentUser } from "@/api";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ROLES = [
  {
    value: "YBF",
    label: "Youth Business Fellow",
    desc: "Build your business with mentorship & resources",
  },
  {
    value: "Instructor",
    label: "Instructor",
    desc: "Teach and guide aspiring entrepreneurs",
  },
  {
    value: "Enumerator",
    label: "Enumerator",
    desc: "Collect data and support field operations",
  },
];

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("YBF");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshUser } = useUser();

  useEffect(() => {
    if (getCurrentUser()) navigate("/dashboard");
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(name, email, password, role);
      refreshUser();
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-sans">
      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex lg:w-5/12 xl:w-2/5 flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, #0f4c3a 0%, #1a7a5e 55%, #2ab08a 100%)",
        }}
      >
        <div
          className="absolute -top-24 -left-24 w-80 h-80 rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, #fff 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-12 right-0 w-64 h-64 rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, #fff 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-2">
              <img
                src="/images/wezesha-impact-logo.png"
                alt="Wezesha Impact Logo"
                className="h-20 w-auto object-contain"
              />
            </div>
            <p className="text-emerald-100/80 text-sm uppercase tracking-[0.3em] text-center">
              Data Management & Case Management System
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1
            className="text-white text-4xl xl:text-5xl font-bold leading-tight"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Join the
            <br />
            Movement
          </h1>
          <p className="text-emerald-100 text-base leading-relaxed max-w-xs">
            Create your account and become part of a growing network of
            change-makers across the region.
          </p>

          {/* Role preview cards */}
          <div className="space-y-2">
            {ROLES.map(({ value, label }) => (
              <div
                key={value}
                className="flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all"
                style={{
                  background:
                    role === value
                      ? "rgba(255,255,255,0.18)"
                      : "rgba(255,255,255,0.07)",
                  borderLeft:
                    role === value ? "3px solid #fff" : "3px solid transparent",
                }}
              >
                <span className="text-white text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
          <p className="text-emerald-100 text-base leading-relaxed max-w-xs">
            Wezesha Impact equips youth with entrepreneurship and job readiness
            skills through two complementary programs. Our in-school stream
            supports TVET finalists, while the out-of-school program serves
            youth through CBO partners.
          </p>
        </div>

        <p className="relative z-10 text-emerald-300 text-sm">
          © {new Date().getFullYear()} Wezesha Impact
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-gray-50 lg:bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <div className="flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-2">
            <img
              src="/images/wezesha-impact-logo.png"
              alt="Wezesha Impact Logo"
              className="h-20 w-auto object-contain"
            />
          </div>
          <p
            className="mt-1 font-medium text-emerald-700"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Data Management & Case Management System
          </p>
        </div>

        <div className="w-full max-w-sm space-y-7">
          <div>
            <h2
              className="text-2xl font-bold text-gray-900 tracking-tight"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Create your account
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Register as a YBF, Instructor, or Enumerator
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="name"
                className="text-xs font-semibold uppercase tracking-widest text-gray-500"
              >
                Full name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Jane Doe"
                className="h-11 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-widest text-gray-500"
              >
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="h-11 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-widest text-gray-500"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="h-11 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500 transition-colors"
              />
            </div>

            {/* Role cards */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                I am a…
              </Label>
              <div className="grid gap-2">
                {ROLES.map(({ value, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className="flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all"
                    style={{
                      borderColor: role === value ? "#1a7a5e" : "#e5e7eb",
                      background: role === value ? "#f0fdf4" : "#fff",
                      boxShadow:
                        role === value ? "0 0 0 2px #1a7a5e22" : "none",
                    }}
                  >
                    <span
                      className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                      style={{
                        borderColor: role === value ? "#1a7a5e" : "#d1d5db",
                        background: role === value ? "#1a7a5e" : "transparent",
                      }}
                    >
                      {role === value && (
                        <svg
                          className="w-2.5 h-2.5 text-white"
                          fill="currentColor"
                          viewBox="0 0 8 8"
                        >
                          <circle cx="4" cy="4" r="2" />
                        </svg>
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              {/* Hidden native select kept for form value */}
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              >
                {ROLES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5">
                <svg
                  className="w-4 h-4 text-red-500 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg text-sm font-semibold tracking-wide transition-all"
              style={{
                background: loading
                  ? "#6b7280"
                  : "linear-gradient(135deg, #0f4c3a, #1a7a5e)",
                color: "#fff",
                border: "none",
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Creating account…
                </span>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-emerald-700 hover:text-emerald-600 underline underline-offset-2 transition-colors"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
export default Register;
