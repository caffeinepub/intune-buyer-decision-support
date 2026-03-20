import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const ok = login(username.trim(), password);
      if (ok) {
        navigate({ to: "/home" });
      } else {
        setError("Invalid credentials. Please try again.");
      }
      setLoading(false);
    }, 400);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0c1a2e 100%)",
      }}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 25%, #F5C518 0%, transparent 50%), radial-gradient(circle at 75% 75%, #F5C518 0%, transparent 50%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        <div
          className="rounded-2xl shadow-2xl border p-8"
          style={{
            background: "rgba(255,255,255,0.04)",
            borderColor: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(16px)",
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="rounded-xl px-6 py-3 mb-5"
              style={{ background: "white" }}
            >
              <img
                src="/assets/uploads/image-1-1.png"
                alt="INTUNE"
                className="h-10 w-auto"
              />
            </div>
            <h1 className="text-xl font-bold text-white text-center leading-tight">
              Buyer Decision Support System
            </h1>
            <p
              className="text-sm mt-1.5 text-center"
              style={{ color: "rgba(148,163,184,1)" }}
            >
              Shoppers Stop – Re-buy Optimization
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="username"
                className="text-sm font-medium"
                style={{ color: "rgba(203,213,225,1)" }}
              >
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                data-ocid="login.input"
                className="h-10 text-sm"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  borderColor: "rgba(255,255,255,0.15)",
                  color: "white",
                }}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-sm font-medium"
                style={{ color: "rgba(203,213,225,1)" }}
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-ocid="login.input"
                className="h-10 text-sm"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  borderColor: "rgba(255,255,255,0.15)",
                  color: "white",
                }}
                required
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg px-4 py-2.5 text-sm font-medium"
                style={{
                  background: "rgba(220,38,38,0.15)",
                  color: "#fca5a5",
                  border: "1px solid rgba(220,38,38,0.3)",
                }}
                data-ocid="login.error_state"
              >
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              className="w-full h-10 font-semibold text-sm mt-1"
              style={{ background: "#F5C518", color: "#1a1a1a" }}
              disabled={loading}
              data-ocid="login.submit_button"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p
            className="text-center text-xs mt-6"
            style={{ color: "rgba(71,85,105,1)" }}
          >
            © {new Date().getFullYear()} Shoppers Stop. Powered by INTUNE.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
