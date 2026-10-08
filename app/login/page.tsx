"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

function getNextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mediaQuery.matches);
    function handleChange(e: MediaQueryListEvent) {
      setIsDark(e.matches);
    }
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const colors = {
    background: isDark ? "#111111" : "#ffffff",
    text: isDark ? "#ededed" : "#171717",
    subtext: isDark ? "#999999" : "#666666",
    inputBg: isDark ? "#1a1a1a" : "#ffffff",
    inputBorder: isDark ? "#333333" : "#e5e5e5",
    buttonBg: isDark ? "#e5e5e5" : "#2c2c2c",
    buttonText: isDark ? "#111111" : "#ffffff",
    errorText: isDark ? "#f87171" : "#dc2626",
  };

  const inputStyle = {
    padding: "12px 14px",
    fontSize: 14,
    fontFamily: "inherit",
    color: colors.text,
    background: colors.inputBg,
    border: `1px solid ${colors.inputBorder}`,
    borderRadius: 10,
    outline: "none",
  } as const;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // The database returns only a private login address (or a decoy for
    // unknown names). Every failure shows the same message on purpose, so
    // this form can't be used to discover which accounts exist.
    const genericError = "Invalid username/email or password.";

    const { data: loginEmail, error: lookupError } = await supabase.rpc("login_email_for", {
      identifier: identifier.trim(),
    });

    if (lookupError || !loginEmail) {
      setError(genericError);
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail as string,
      password,
    });

    if (signInError) {
      setError(genericError);
      setLoading(false);
      return;
    }

    router.push(getNextPath());
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
        fontFamily: "var(--font-funnel-sans), Arial, sans-serif",
        padding: 20,
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.text, marginBottom: 24 }}>
        Log in
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 320 }}
      >
        <input
          type="text"
          placeholder="Username or email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />

        {error && <div style={{ fontSize: 13, color: colors.errorText }}>{error}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 8,
            padding: "12px 14px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            border: "none",
            borderRadius: 10,
            background: colors.buttonBg,
            color: colors.buttonText,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p style={{ fontSize: 13, color: colors.subtext, marginTop: 20 }}>
        Don't have an account?{" "}
        <Link href="/signup" style={{ color: colors.text, fontWeight: 600 }}>
          Sign up
        </Link>
      </p>
    </div>
  );
}