import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset, resetPassword } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";

const ForgotPassword = () => {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await requestPasswordReset(email);
      const codeMessage = response.resetToken
        ? `A reset code has been prepared. Use this code: ${response.resetToken}`
        : "A reset code has been prepared. Enter it below along with your new password.";
      setMessage(`${response.message || ""} ${codeMessage}`.trim());
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request a reset right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      await resetPassword(email, token, password);
      setMessage("Password updated successfully. You can sign in with your new password.");
      setStep("request");
      setToken("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset your password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-sans relative">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div
        className="hidden lg:flex lg:w-5/12 xl:w-2/5 flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #0f4c3a 0%, #1a7a5e 55%, #2ab08a 100%)",
        }}
      >
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-2">
              <img src="/images/wezesha-impact-logo.png" alt="Wezesha Impact Logo" className="h-20 w-auto object-contain" />
            </div>
            <p className="text-emerald-100/80 text-sm uppercase tracking-[0.3em] text-center">
              Account Recovery
            </p>
          </div>
          <div className="space-y-4">
            <h1 className="text-white text-4xl xl:text-5xl font-bold leading-tight" style={{ fontFamily: "'Georgia', serif" }}>
              Reset your password securely.
            </h1>
            <p className="text-emerald-100 text-base leading-relaxed max-w-xs">
              Enter your email to receive a reset code, then create a new password for your account.
            </p>
          </div>
        </div>
        <p className="relative z-10 text-emerald-300 text-sm">© {new Date().getFullYear()} Wezesha Impact</p>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-gray-50 lg:bg-white dark:bg-slate-950 dark:text-slate-100">
        <div className="w-full max-w-sm space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'Georgia', serif", color: "hsl(152, 55%, 33%)" }}>
              Forgot your password?
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {step === "request"
                ? "Provide your email address to start a reset request."
                : "Use the code you received and choose a stronger password."}
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
              {message}
            </div>
          )}

          {step === "request" ? (
            <form onSubmit={handleRequest} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-300">
                  Email address
                </Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 rounded-lg">
                {loading ? "Sending…" : "Send reset code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-300">
                  Email address
                </Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="token" className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-300">
                  Reset code
                </Label>
                <Input id="token" value={token} onChange={(e) => setToken(e.target.value)} required placeholder="Paste the reset code" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-300">
                  New password
                </Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-300">
                  Confirm password
                </Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 rounded-lg">
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-gray-500">
            Remembered your password?{" "}
            <Link to="/login" className="font-semibold text-emerald-700 hover:text-emerald-600 underline underline-offset-2 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
