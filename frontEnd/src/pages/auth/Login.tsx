import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "@/api";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, refreshUser } = useUser();

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      refreshUser(); // Refresh the user context after login
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-sans relative">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex lg:w-5/12 xl:w-2/5 flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, #0f4c3a 0%, #1a7a5e 55%, #2ab08a 100%)",
        }}
      >
        {/* Decorative circles */}
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
        <div
          className="absolute top-1/2 -right-12 w-40 h-40 rounded-full opacity-5"
          style={{
            background: "radial-gradient(circle, #fff 0%, transparent 70%)",
          }}
        />

        {/* Logo and system title */}
        <div className="relative z-10 space-y-4">
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

          {/* Illustration immediately after logo */}
          <div className="relative z-10 pt-4">
            <img
              src="/images/African-Students.jpg"
              alt="African youth students studying together"
              className="w-full rounded-3xl border border-white/10 shadow-2xl object-cover h-64"
            />
          </div>

          <div className="space-y-4">
            <h1
              className="text-white text-4xl xl:text-5xl font-bold leading-tight"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Improving
              <br />
              the employment outcomes of
              <br />
              Youth in Africa.
            </h1>
            <p className="text-emerald-100 text-base leading-relaxed max-w-xs">
              Wezesha Impact equips youth with entrepreneurship and job
              readiness skills through two complementary programs. Our in-school
              stream supports TVET finalists, while the out-of-school program
              serves youth through CBO partners.
            </p>
          </div>
        </div>

        {/* Tagline footer */}
        <p className="relative z-10 text-emerald-300 text-sm">
          © {new Date().getFullYear()} Wezesha Impact
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-gray-50 lg:bg-white dark:bg-slate-950 dark:text-slate-100">
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

        <div className="w-full max-w-sm space-y-8">
          {/* Heading */}
          <div>
            <h2
              className="text-2xl font-bold text-gray-900 tracking-tight"
              style={{
                fontFamily: "'Georgia', serif",
                color: "hsl(152, 55%, 33%)",
              }}
            >
              Welcome !
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Sign in to your account to continue
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-300"
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
                className="h-11 rounded-lg border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-300"
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
                className="h-11 rounded-lg border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
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
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="rounded-lg border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-center text-xs text-emerald-800">
            Use your organization credentials. Contact your system administrator
            if you need an account.
          </p>

          <p className="text-center text-sm text-gray-500">
            No account?{" "}
            <Link
              to="/register"
              className="font-semibold text-emerald-700 hover:text-emerald-600 underline underline-offset-2 transition-colors"
            >
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
export default Login;
