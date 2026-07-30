import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Ingresar | Registro de Pagos" },
      { name: "description", content: "Acceso privado para administrar los pagos de los repartos." },
      { property: "og:title", content: "Ingresar | Registro de Pagos" },
      { property: "og:description", content: "Acceso privado para administrar los pagos de los repartos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          });
    setLoading(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (data.session) navigate({ to: "/" });
    else setMsg("Revisá tu email para confirmar la cuenta.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-bold text-foreground">
          {mode === "login" ? "Ingresar" : "Crear cuenta"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acceso privado para administrar los pagos.
        </p>

        <label className="mt-5 block text-xs font-medium text-muted-foreground">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />

        <label className="mt-3 block text-xs font-medium text-muted-foreground">Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />

        {msg && <p className="mt-3 text-sm text-destructive">{msg}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "..." : mode === "login" ? "Ingresar" : "Crear cuenta"}
        </button>

        <div className="mt-4 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(null); }}
            className="text-muted-foreground underline hover:text-foreground"
          >
            {mode === "login" ? "Crear cuenta" : "Ya tengo cuenta"}
          </button>
          <a href="/" className="text-muted-foreground underline hover:text-foreground">
            Volver
          </a>
        </div>
      </form>
    </div>
  );
}
