"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [identifier, setIdentifier] = useState(""); // username OR email
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmedIdentifier = identifier.trim();
    const looksLikeEmail = trimmedIdentifier.includes("@");

    let authEmail: string;

    if (looksLikeEmail) {
      // They typed something email-shaped — use it directly. This also
      // naturally covers the placeholder emails for accounts created
      // without a real one, in case someone remembers their generated one.
      authEmail = trimmedIdentifier;
    } else {
      // Treat it as a username — look up the account's real auth email,
      // falling back to the generated placeholder pattern if this account
      // predates the "store the real email on the profile" change.
      const normalizedUsername = trimmedIdentifier.toLowerCase();
      const { data: profile, error: lookupError } = await supabase
        .from("profiles")
        .select("email")
        .eq("username", normalizedUsername)
        .single();

      if (lookupError || !profile) {
        setError("No account found with that username.");
        setLoading(false);
        return;
      }

      authEmail = profile.email ?? `${normalizedUsername}@notebooook.local`;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/");
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
          style={{
            padding: "12px 14px",
            fontSize: 14,
            fontFamily: "inherit",
            color: colors.text,
            background: colors.inputBg,
            border: `1px solid ${colors.inputBorder}`,
            borderRadius: 10,
            outline: "none",
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            padding: "12px 14px",
            fontSize: 14,
            fontFamily: "inherit",
            color: colors.text,
            background: colors.inputBg,
            border: `1px solid ${colors.inputBorder}`,
            borderRadius: 10,
            outline: "none",
          }}
        />

        {error && (
          <div style={{ fontSize: 13, color: colors.errorText }}>{error}</div>
        )}

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