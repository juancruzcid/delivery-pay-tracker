import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Package, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { analizarPedidos, type AnalizarResult } from "@/lib/productos.functions";

export const Route = createFileRoute("/productos")({
  component: ProductosPage,
  head: () => ({
    meta: [
      { title: "Productos | Registro de Pagos" },
      { name: "description", content: "Productos más comprados por tus clientes, detectados automáticamente desde los PDF de pedidos, con filtro por mes." },
      { property: "og:title", content: "Productos | Registro de Pagos" },
      { property: "og:description", content: "Productos más comprados por tus clientes, detectados automáticamente desde los PDF de pedidos, con filtro por mes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Item = {
  producto: string;
  cantidad: number;
  payment_id: string;
  categoria: string;
  payments: { fecha: string; cliente: string; subtotal: number } | null;
};

function ProductosPage() {
  const [session, setSession] = useState<boolean | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [mes, setMes] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalizarResult | null>(null);
  const analizar = useServerFn(analizarPedidos);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const [categoria, setCategoria] = useState("");

  const load = () => {
    supabase
      .from("pedido_items" as any)
      .select("producto, cantidad, payment_id, categoria, payments(fecha, cliente, subtotal)")
      .then(({ data }) => setItems(((data as unknown) as Item[]) ?? []));
  };

  useEffect(() => {
    if (session) load();
  }, [session]);

  const months = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.payments?.fecha?.slice(0, 7)).filter(Boolean) as string[]))
        .sort()
        .reverse(),
    [items],
  );

  const categorias = useMemo(
    () => Array.from(new Set(items.map((i) => i.categoria).filter(Boolean) as string[])).sort(),
    [items],
  );

  const productos = useMemo(() => {
    const map = new Map<string, { producto: string; cantidad: number; pedidos: Set<string>; clientes: Set<string>; categoria: string }>();
    for (const i of items) {
      if (i.producto === "(sin productos detectados)") continue;
      if (mes && i.payments?.fecha?.slice(0, 7) !== mes) continue;
      if (categoria && i.categoria !== categoria) continue;
      const cur = map.get(i.producto) ?? { producto: i.producto, cantidad: 0, pedidos: new Set(), clientes: new Set(), categoria: i.categoria };
      const cant = Number(i.cantidad || 0);
      cur.cantidad += cant;
      cur.pedidos.add(i.payment_id);
      if (i.payments?.cliente) cur.clientes.add(i.payments.cliente);
      map.set(i.producto, cur);
    }
    const term = q.trim().toLowerCase();
    return Array.from(map.values())
      .filter((p) => !term || p.producto.includes(term))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [items, mes, q, categoria]);

  const top30Cantidad = productos.slice(0, 30);

  const run = async () => {
    if (loading) return;
    setLoading(true);
    setResult(null);
    let totalAnalizados = 0;
    let totalItems = 0;
    const errores: string[] = [];
    try {
      for (let i = 0; i < 40; i++) {
        const r = await analizar();
        totalAnalizados += r.analizados;
        totalItems += r.items;
        errores.push(...r.errores);
        setResult({ analizados: totalAnalizados, items: totalItems, pendientes: r.pendientes, errores });
        load();
        if (r.pendientes === 0 || r.analizados === 0) break;
      }
    } catch (e: any) {
      setResult({
        analizados: totalAnalizados,
        items: totalItems,
        pendientes: 0,
        errores: [...errores, String(e?.message ?? e)],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (session === null) return null;

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">Sección privada</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ingresá con tu cuenta para ver los productos.</p>
          <Link to="/auth" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Ingresar
          </Link>
        </div>
      </div>
    );
  }

  const maxCant = productos[0]?.cantidad ?? 1;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Productos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Qué se compra más, leído automáticamente desde los PDF de pedidos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={run}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Leyendo PDF..." : "Leer pedidos nuevos"}
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" /> Volver
            </Link>
          </div>
        </div>

        {result && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm shadow-sm">
            <p className="text-foreground">
              Se leyeron <strong>{result.analizados}</strong> pedidos ({result.items} productos).{" "}
              {result.pendientes > 0
                ? `Quedan ${result.pendientes} pedidos por leer: volvé a tocar el botón.`
                : "No quedan pedidos pendientes."}
            </p>
            {result.errores.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs text-destructive">
                {result.errores.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar producto..."
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
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-3 text-sm capitalize text-foreground shadow-sm outline-none focus:border-primary"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
            <Package className="h-4 w-4" /> {productos.length} productos distintos
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                   <th className="px-4 py-3 text-left font-semibold">#</th>
                   <th className="px-4 py-3 text-left font-semibold">Producto</th>
                   <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                   <th className="px-4 py-3 text-right font-semibold">Unidades</th>
                   <th className="px-4 py-3 text-right font-semibold">Pedidos</th>
                   <th className="px-4 py-3 text-right font-semibold">Clientes</th>
                   <th className="px-4 py-3 text-left font-semibold">Peso</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-border">
                 {productos.map((p, i) => (
                   <tr key={p.producto} className="hover:bg-accent/40">
                     <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                     <td className="px-4 py-3 font-medium capitalize text-foreground">{p.producto}</td>
                     <td className="px-4 py-3 capitalize text-muted-foreground">{p.categoria}</td>
                     <td className="px-4 py-3 text-right font-semibold tabular-nums">{p.cantidad}</td>
                     <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{p.pedidos.size}</td>
                     <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{p.clientes.size}</td>
                     <td className="px-4 py-3">
                       <div className="h-2 w-full max-w-[240px] overflow-hidden rounded-full bg-muted">
                         <div className="h-full rounded-full bg-primary" style={{ width: `${(p.cantidad / maxCant) * 100}%` }} />
                       </div>
                     </td>
                   </tr>
                 ))}
                 {productos.length === 0 && (
                   <tr>
                     <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                       Todavía no hay productos leídos. Tocá "Leer pedidos nuevos".
                     </td>
                   </tr>
                 )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Top 30 por cantidad</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {top30Cantidad.map((p, i) => (
                <tr key={p.producto} className="hover:bg-accent/40">
                  <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2 font-medium capitalize text-foreground">{p.producto}</td>
                  <td className="px-4 py-2 capitalize text-muted-foreground">{p.categoria}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{p.cantidad}</td>
                </tr>
              ))}
              {top30Cantidad.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground">Sin datos todavía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
