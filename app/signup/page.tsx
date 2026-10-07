"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

const RESERVED_USERNAMES = [
  "admin", "support", "help", "login", "signup", "page", "user",
  "my", "feed", "settings", "api", "notebooook", "stats", "b",
];

function validateUsername(username: string): string | null {
  if (username.length < 2 || username.length > 18) {
    return "Username must be 2–18 characters.";
  }
  if (!/^[a-z0-9_.]+$/.test(username)) {
    return "Only lowercase letters, numbers, _ and . are allowed.";
  }
  if (RESERVED_USERNAMES.includes(username)) {
    return "That username is reserved.";
  }
  return null;
}

export default function SignupPage() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
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

    const normalizedUsername = username.trim().toLowerCase();
    const usernameError = validateUsername(normalizedUsername);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    setLoading(true);

    // Friendly pre-check; the database trigger is the real enforcement.
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", normalizedUsername)
      .maybeSingle();
    if (existing) {
      setError("That username is already taken.");
      setLoading(false);
      return;
    }

    // The account's login address is a random private placeholder. The real
    // email (if given) is stored separately in a table only its owner can read.
    const { error: signUpError } = await supabase.auth.signUp({
      email: `${crypto.randomUUID()}@notebooook.local`,
      password,
      options: {
        data: {
          username: normalizedUsername,
          contact_email: email.trim().toLowerCase(),
        },
      },
    });

    if (signUpError) {
      setError(
        signUpError.message.includes("Database error")
          ? "That username or email is already taken."
          : signUpError.message
      );
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
        Create your account
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 320 }}
      >
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="email"
          placeholder="Email (optional, for now)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
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
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <p style={{ fontSize: 13, color: colors.subtext, marginTop: 20 }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: colors.text, fontWeight: 600 }}>
          Log in
        </Link>
      </p>
    </div>
  );
}