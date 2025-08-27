import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("token");
    setToken(t);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && token) {
      router.replace("/dashboard");
    }
  }, [loading, token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const API = process.env.NEXT_PUBLIC_API_URL;
    if (!API) {
      setError("Missing API URL");
      return;
    }

    let res: Response;
    try {
      res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      setError("Could not connect to server");
      return;
    }

    let payload: any = {};
    try {
      payload = await res.json();
    } catch {
      setError("Invalid server response");
      return;
    }

    if (!res.ok) {
      setError(payload.detail || "Login failed");
      return;
    }

    localStorage.setItem("token", payload.access_token);
    router.replace("/dashboard");
  }

  if (loading || token) return null;

  return (
    <div style={{ maxWidth: 400, margin: "2rem auto", padding: "1rem" }}>
      <h2>Log In</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <br />
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
        />
        <br />
        <br />

        <label htmlFor="password">Password</label>
        <br />
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
        />
        <br />
        <br />

        <button
          type="submit"
          style={{
            width: "100%",
            padding: "0.75rem",
            background: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Log In
        </button>
      </form>

      {error && (
        <p
          style={{
            color: "crimson",
            whiteSpace: "pre-wrap",
            marginTop: "1rem",
          }}
        >
          {error}
        </p>
      )}

      <p style={{ marginTop: "1.5rem" }}>
        Don't have an account? <Link href="/register">Sign up</Link>
      </p>
    </div>
  );
}
