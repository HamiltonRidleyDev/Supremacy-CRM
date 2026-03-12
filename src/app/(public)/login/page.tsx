"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type LoginMode = "password" | "magic";
type MagicStep = "identifier" | "code" | "not_found";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-muted">Loading...</div></div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [mode, setMode] = useState<LoginMode>("magic");
  const [magicStep, setMagicStep] = useState<MagicStep>("identifier");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Password mode
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Magic mode
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");

  // Access request mode
  const [reqName, setReqName] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqPhone, setReqPhone] = useState("");
  const [reqMessage, setReqMessage] = useState("");
  const [reqSent, setReqSent] = useState(false);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      router.push(redirect);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicRequest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          // No account found — show access request form
          const isEmail = identifier.includes("@");
          if (isEmail) setReqEmail(identifier);
          else setReqPhone(identifier);
          setMagicStep("not_found");
          return;
        }
        setError(data.error || "Could not find account");
        return;
      }

      if (data._devCode) {
        setDevCode(data._devCode);
      }
      setMagicStep("code");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid code");
        return;
      }

      router.push(redirect);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccessRequest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: reqName,
          email: reqEmail || null,
          phone: reqPhone || null,
          message: reqMessage || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Request failed");
        return;
      }

      setReqSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Supremacy <span className="text-accent">BJJ</span>
          </h1>
          <p className="text-muted mt-2 text-sm">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-6">
          {/* Mode Toggle — hide during not_found/access request */}
          {magicStep !== "not_found" && (
            <div className="flex mb-6 bg-background rounded-lg p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("magic");
                  setError("");
                }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  mode === "magic"
                    ? "bg-card text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Member Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("password");
                  setError("");
                }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  mode === "password"
                    ? "bg-card text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Staff Login
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
              {error}
            </div>
          )}

          {/* Password Login Form */}
          {mode === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@supremacyjj.com"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-accent hover:bg-accent-dim text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          {/* Magic Code Flow — Step 1: Enter identifier */}
          {mode === "magic" && magicStep === "identifier" && (
            <form onSubmit={handleMagicRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Email or Phone
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  placeholder="your@email.com or (555) 123-4567"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-accent hover:bg-accent-dim text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Looking up account..." : "Send Login Code"}
              </button>
              <p className="text-xs text-muted text-center">
                We&apos;ll send a 6-digit code to verify your identity.
              </p>
            </form>
          )}

          {/* Magic Code Flow — Step 2: Enter code */}
          {mode === "magic" && magicStep === "code" && (
            <form onSubmit={handleMagicVerify} className="space-y-4">
              <p className="text-sm text-muted">
                Enter the 6-digit code sent to{" "}
                <span className="text-foreground font-medium">
                  {identifier}
                </span>
              </p>

              {/* Dev code display */}
              {devCode && (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm">
                  <span className="text-warning font-medium">DEV MODE:</span>{" "}
                  Your code is{" "}
                  <span className="font-mono text-foreground font-bold tracking-widest">
                    {devCode}
                  </span>
                </div>
              )}

              <div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                  maxLength={6}
                  placeholder="000000"
                  className="w-full px-3 py-4 bg-background border border-border rounded-lg text-foreground text-center text-2xl font-mono tracking-[0.5em] placeholder:text-muted/30 focus:outline-none focus:border-accent transition-colors"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full py-2.5 bg-accent hover:bg-accent-dim text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Sign In"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMagicStep("identifier");
                  setCode("");
                  setDevCode("");
                  setError("");
                }}
                className="w-full py-2 text-sm text-muted hover:text-foreground transition-colors"
              >
                Use a different email or phone
              </button>
            </form>
          )}

          {/* Access Request — account not found */}
          {mode === "magic" && magicStep === "not_found" && !reqSent && (
            <div>
              <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                <p className="text-sm font-medium text-warning">Account not found</p>
                <p className="text-xs text-muted mt-1">
                  We couldn&apos;t find <span className="text-foreground">{identifier}</span> in our system.
                  This usually means we have a different email or phone number on file for you.
                </p>
              </div>

              <p className="text-sm mb-4">
                Request access and we&apos;ll get you set up:
              </p>

              <form onSubmit={handleAccessRequest} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Your name</label>
                  <input
                    type="text"
                    value={reqName}
                    onChange={(e) => setReqName(e.target.value)}
                    required
                    placeholder="First and last name"
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Email</label>
                  <input
                    type="email"
                    value={reqEmail}
                    onChange={(e) => setReqEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Phone</label>
                  <input
                    type="tel"
                    value={reqPhone}
                    onChange={(e) => setReqPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Anything else? (optional)</label>
                  <textarea
                    value={reqMessage}
                    onChange={(e) => setReqMessage(e.target.value)}
                    placeholder="e.g., I train in the Monday evening class"
                    rows={2}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors text-sm resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !reqName.trim() || (!reqEmail.trim() && !reqPhone.trim())}
                  className="w-full py-2.5 bg-accent hover:bg-accent-dim text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Request Access"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMagicStep("identifier");
                    setError("");
                  }}
                  className="w-full py-2 text-sm text-muted hover:text-foreground transition-colors"
                >
                  Try a different email or phone
                </button>
              </form>
            </div>
          )}

          {/* Access Request — success */}
          {mode === "magic" && magicStep === "not_found" && reqSent && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-success/20 text-success flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="font-semibold">Request submitted!</p>
              <p className="text-sm text-muted mt-2 leading-relaxed">
                Someone from the gym will update your contact info and let you know when you can log in.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMagicStep("identifier");
                  setReqSent(false);
                  setReqName("");
                  setReqEmail("");
                  setReqPhone("");
                  setReqMessage("");
                  setError("");
                }}
                className="mt-4 text-sm text-accent hover:underline"
              >
                Back to login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
