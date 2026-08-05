import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Database, HardDrive, FileStack } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUsageStats, type UsageStats } from "@/lib/usage.functions";

export const Route = createFileRoute("/uso")({
  component: UsoPage,
  head: () => ({
    meta: [
      { title: "Uso del plan | Registro de Pagos" },
      { name: "description", content: "Espacio usado y disponible en la base de datos y en los documentos adjuntos de tu plan gratuito." },
      { property: "og:title", content: "Uso del plan | Registro de Pagos" },
      { property: "og:description", content: "Espacio usado y disponible en la base de datos y en los documentos adjuntos de tu plan gratuito." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const DB_LIMIT = 500 * 1024 * 1024; // 500 MB
const STORAGE_LIMIT = 1024 * 1024 * 1024; // 1 GB

const fmtBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(2)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

function Bar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, (used / limit) * 100);
  const color = pct > 85 ? "bg-destructive" : pct > 60 ? "bg-warning" : "bg-success";
  return (
    <div className="mt-3">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 0.5)}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {pct < 0.01 ? "<0,01" : pct.toFixed(2)}% usado · quedan {fmtBytes(Math.max(limit - used, 0))} libres
      </p>
    </div>
  );
}

function UsoPage() {
  const [session, setSession] = useState<boolean | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchStats = useServerFn(getUsageStats);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchStats()
      .then(setStats)
      .catch((e) => setError(String(e?.message ?? e)));
  }, [session]);

  if (session === null) return null;

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">Sección privada</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ingresá con tu cuenta para ver el uso del plan.</p>
          <Link to="/auth" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Ingresar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">Uso del plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Espacio consumido y disponible en el plan gratuito (500 MB de base de datos y 1 GB de documentos).
        </p>

        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}
        {!stats && !error && <p className="mt-6 text-sm text-muted-foreground">Calculando…</p>}

        {stats && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Database className="h-4 w-4" /> Base de datos (estimado)
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-foreground">{fmtBytes(stats.dbBytesEstimated)}</p>
                <p className="text-xs text-muted-foreground">de 500 MB · {stats.rows} pedidos registrados</p>
                <Bar used={stats.dbBytesEstimated} limit={DB_LIMIT} />
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <HardDrive className="h-4 w-4" /> Documentos adjuntos
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-foreground">{fmtBytes(stats.storageBytes)}</p>
                <p className="text-xs text-muted-foreground">de 1 GB · {stats.files} archivos</p>
                <Bar used={stats.storageBytes} limit={STORAGE_LIMIT} />
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Card label="Pedidos" value={String(stats.rows)} />
              <Card label="Archivos PDF" value={String(stats.files)} />
              <Card
                label="Peso promedio por PDF"
                value={stats.files ? fmtBytes(Math.round(stats.storageBytes / stats.files)) : "—"}
              />
            </div>

            {stats.files > 0 && (
              <p className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                A este ritmo ({fmtBytes(Math.round(stats.storageBytes / Math.max(stats.files, 1)))} por PDF) te entran
                aproximadamente{" "}
                <strong className="text-foreground">
                  {Math.floor((STORAGE_LIMIT - stats.storageBytes) / Math.max(stats.storageBytes / stats.files, 1)).toLocaleString("es-AR")}
                </strong>{" "}
                documentos más antes de llenar el espacio gratuito.
              </p>
            )}

            <div className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileStack className="h-4 w-4" /> Consumo por mes
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Descargá el backup de los meses más viejos y borrá esos pedidos para liberar espacio.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4">Mes</th>
                      <th className="py-2 pr-4">Pedidos</th>
                      <th className="py-2 pr-4">Archivos</th>
                      <th className="py-2">Espacio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byMonth.map((m) => (
                      <tr key={m.mes} className="border-b border-border/60">
                        <td className="py-2 pr-4 font-mono">{m.mes}</td>
                        <td className="py-2 pr-4">{m.pedidos}</td>
                        <td className="py-2 pr-4">{m.archivos}</td>
                        <td className="py-2 font-mono">{fmtBytes(m.bytes)}</td>
                      </tr>
                    ))}
                    {stats.byMonth.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-muted-foreground">
                          Sin datos todavía.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
