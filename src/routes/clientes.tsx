import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Trophy, TrendingDown, Users, Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/clientes")({
  component: ClientesPage,
  head: () => ({
    meta: [
      { title: "Clientes | Registro de Pagos" },
      { name: "description", content: "Listado de clientes con cantidad de pedidos, montos comprados, frecuencia de compra y rankings por mes o total." },
      { property: "og:title", content: "Clientes | Registro de Pagos" },
      { property: "og:description", content: "Listado de clientes con cantidad de pedidos, montos comprados, frecuencia de compra y rankings por mes o total." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = { fecha: string; cliente: string; subtotal: number; envio: number; monto: number; estado_envio: string };

type Cliente = {
  cliente: string;
  pedidos: number;
  vendido: number;
  envios: number;
  total: number;
  ticket: number;
  primera: string;
  ultima: string;
  frecuencia: number | null;
  diasSinComprar: number;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

type SortKey = "pedidos" | "total" | "vendido" | "ultima" | "frecuencia" | "cliente";

function ClientesPage() {
  const [session, setSession] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [mes, setMes] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("total");
  const [asc, setAsc] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("payments")
      .select("fecha, cliente, subtotal, envio, monto, estado_envio")
      .order("fecha", { ascending: true })
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, [session]);

  const months = useMemo(
    () => Array.from(new Set(rows.map((r) => r.fecha.slice(0, 7)))).sort().reverse(),
    [rows],
  );

  const clientes = useMemo<Cliente[]>(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      if (mes && r.fecha.slice(0, 7) !== mes) continue;
      const key = (r.cliente || "").trim();
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([cliente, list]) => {
      const fechas = list.map((r) => r.fecha).sort();
      const vendido = list.reduce((a, r) => a + Number(r.subtotal || 0), 0);
      const envios = list.reduce((a, r) => a + Number(r.envio || 0), 0);
      const primera = fechas[0];
      const ultima = fechas[fechas.length - 1];
      const frecuencia =
        fechas.length > 1 ? Math.round(daysBetween(primera, ultima) / (fechas.length - 1)) : null;
      return {
        cliente,
        pedidos: list.length,
        vendido,
        envios,
        total: vendido + envios,
        ticket: vendido / list.length,
        primera,
        ultima,
        frecuencia,
        diasSinComprar: daysBetween(ultima, hoy),
      };
    });
  }, [rows, mes]);

  const visibles = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = clientes.filter((c) => !term || c.cliente.toLowerCase().includes(term));
    const dir = asc ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort === "cliente") return a.cliente.localeCompare(b.cliente) * dir;
      if (sort === "ultima") return a.ultima.localeCompare(b.ultima) * dir;
      if (sort === "frecuencia") return ((a.frecuencia ?? 99999) - (b.frecuencia ?? 99999)) * dir;
      return ((a[sort] as number) - (b[sort] as number)) * dir;
    });
  }, [clientes, q, sort, asc]);

  const top = (key: "pedidos" | "total", dir: 1 | -1) =>
    [...clientes].sort((a, b) => (b[key] - a[key]) * dir).slice(0, 5);

  const resumen = useMemo(() => {
    const totalPedidos = clientes.reduce((a, c) => a + c.pedidos, 0);
    const totalPlata = clientes.reduce((a, c) => a + c.total, 0);
    const recurrentes = clientes.filter((c) => c.pedidos > 1).length;
    const frec = clientes.filter((c) => c.frecuencia != null).map((c) => c.frecuencia as number);
    return {
      totalPedidos,
      totalPlata,
      recurrentes,
      frecMedia: frec.length ? Math.round(frec.reduce((a, b) => a + b, 0) / frec.length) : null,
    };
  }, [clientes]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc((v) => !v);
    else {
      setSort(key);
      setAsc(key === "cliente");
    }
  };

  if (session === null) return null;

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">Sección privada</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ingresá con tu cuenta para ver los clientes.</p>
          <Link to="/auth" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Ingresar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Clientes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Quién compra más, cuánto gasta y cada cuánto vuelve a pedir.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card icon={<Users className="h-4 w-4" />} label="CLIENTES" value={String(clientes.length)} />
          <Card icon={<Repeat className="h-4 w-4" />} label="RECURRENTES" value={String(resumen.recurrentes)} hint="con más de 1 pedido" />
          <Card icon={<Trophy className="h-4 w-4" />} label="PEDIDOS" value={String(resumen.totalPedidos)} />
          <Card
            icon={<TrendingDown className="h-4 w-4" />}
            label="FRECUENCIA MEDIA"
            value={resumen.frecMedia != null ? `${resumen.frecMedia} días` : "—"}
            hint="entre pedidos"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full rounded-lg border border-border bg-card py-3 pl-10 pr-3 text-sm text-foreground shadow-sm outline-none focus:border-primary"
            />
          </div>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-3 text-sm text-foreground shadow-sm outline-none focus:border-primary"
          >
            <option value="">Todos los meses</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Ranking title="Más pedidos" items={top("pedidos", 1)} render={(c) => `${c.pedidos} pedidos`} />
          <Ranking title="Más plata" items={top("total", 1)} render={(c) => `$ ${fmtMoney(c.total)}`} />
          <Ranking title="Menos pedidos" items={top("pedidos", -1)} render={(c) => `${c.pedidos} pedidos`} />
          <Ranking title="Menos plata" items={top("total", -1)} render={(c) => `$ ${fmtMoney(c.total)}`} />
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <Th onClick={() => toggleSort("cliente")}>Cliente</Th>
                  <Th onClick={() => toggleSort("pedidos")} right>Pedidos</Th>
                  <Th onClick={() => toggleSort("vendido")} right>Vendido</Th>
                  <Th right>Envíos</Th>
                  <Th onClick={() => toggleSort("total")} right>Total</Th>
                  <Th right>Ticket prom.</Th>
                  <Th onClick={() => toggleSort("frecuencia")} right>Frecuencia</Th>
                  <Th>Primer pedido</Th>
                  <Th onClick={() => toggleSort("ultima")}>Último pedido</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibles.map((c) => (
                  <tr key={c.cliente} className="hover:bg-accent/40">
                    <td className="px-4 py-3 font-medium text-foreground">{c.cliente}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.pedidos}</td>
                    <td className="px-4 py-3 text-right tabular-nums">$ {fmtMoney(c.vendido)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">$ {fmtMoney(c.envios)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">$ {fmtMoney(c.total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">$ {fmtMoney(c.ticket)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {c.frecuencia != null ? `cada ${c.frecuencia} días` : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.primera)}</td>
                    <td className="px-4 py-3">
                      {fmtDate(c.ultima)}
                      <span className="ml-2 text-xs text-muted-foreground">hace {c.diasSinComprar} d</span>
                    </td>
                  </tr>
                ))}
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                      No hay clientes para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Th({ children, onClick, right }: { children: React.ReactNode; onClick?: () => void; right?: boolean }) {
  return (
    <th
      onClick={onClick}
      className={`px-4 py-3 font-semibold ${right ? "text-right" : "text-left"} ${onClick ? "cursor-pointer select-none hover:text-foreground" : ""}`}
    >
      {children}
    </th>
  );
}

function Card({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Ranking({ title, items, render }: { title: string; items: Cliente[]; render: (c: Cliente) => string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ol className="mt-3 space-y-2">
        {items.map((c, i) => (
          <li key={c.cliente} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-muted-foreground">
              {i + 1}. {c.cliente}
            </span>
            <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">{render(c)}</span>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-muted-foreground">Sin datos.</li>}
      </ol>
    </div>
  );
}
