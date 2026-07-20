import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Calendar, FileText, Trash2, Download, X, Check, Pencil } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const ENVIO_PCT = 0.05;
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Index,
});

type EstadoEnvio = "retiro" | "pendiente" | "enviado";

type Payment = {
  id: string;
  fecha: string;
  cliente: string;
  subtotal: number;
  envio: number;
  monto: number;
  retira: boolean;
  estado_envio: EstadoEnvio;
  recibo: boolean;
  transferencia: number;
  efectivo: number;
  observaciones: string | null;
  recibo_pdf_path: string | null;
  transferencia_pdf_path: string | null;
};

const ESTADO_LABEL: Record<EstadoEnvio, string> = {
  retiro: "Retiro",
  pendiente: "Pendiente",
  enviado: "Enviado",
};

const ESTADO_CLASS: Record<EstadoEnvio, string> = {
  retiro: "bg-muted text-foreground border-border",
  pendiente: "bg-warning/15 text-warning border-warning/30",
  enviado: "bg-success/15 text-success border-success/30",
};


const BUCKET = "payment-docs";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

function Index() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setPayments((data as Payment[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (search && !p.cliente.toLowerCase().includes(search.toLowerCase())) return false;
      if (dateFilter && p.fecha !== dateFilter) return false;
      if (monthFilter && !p.fecha.startsWith(monthFilter)) return false;
      return true;
    });
  }, [payments, search, dateFilter, monthFilter]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, p) => {
        acc.vendido += Number(p.subtotal);
        acc.envios += p.estado_envio === "enviado" ? Number(p.envio) : 0;
        return acc;
      },
      { vendido: 0, envios: 0 }
    );
  }, [filtered]);

  const months = useMemo(() => {
    const set = new Set(payments.map((p) => p.fecha.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [payments]);

  const clientes = useMemo(() => {
    const set = new Set(payments.map((p) => p.cliente).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [payments]);

  const setEstado = async (p: Payment, estado: EstadoEnvio) => {
    const patch = { estado_envio: estado, retira: estado === "retiro" };
    const { error } = await supabase.from("payments").update(patch).eq("id", p.id);
    if (!error) setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
  };


  const remove = async (p: Payment) => {
    if (!confirm(`¿Eliminar el pago de ${p.cliente}?`)) return;
    const paths = [p.recibo_pdf_path, p.transferencia_pdf_path].filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    await supabase.from("payments").delete().eq("id", p.id);
    setPayments((prev) => prev.filter((x) => x.id !== p.id));
  };

  const downloadPdf = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data) {
      alert("No se pudo generar el enlace.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Registro de Pagos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cargá y buscá los pagos de los pedidos que repartís.
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Nuevo pago
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="VENDIDO" amount={totals.vendido} />
          <SummaryCard label="ENVÍOS" amount={totals.envios} color="info" />
          <SummaryCard label="TOTAL" amount={totals.vendido + totals.envios} color="success" />
          <SummaryCard label="CANTIDAD" amount={filtered.length} isCount />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="">Todos los meses</option>
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-center">Envío</th>
                  <th className="px-4 py-3 text-right">Transferencia</th>
                  <th className="px-4 py-3 text-right">Efectivo</th>
                  <th className="px-4 py-3">Observaciones</th>
                  <th className="px-4 py-3 text-center">Documentos</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="font-mono tabular">
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">Cargando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">No hay pagos registrados.</td></tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-3">{fmtDate(p.fecha)}</td>
                      <td className="px-4 py-3 font-sans font-medium">{p.cliente}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">$ {fmtMoney(p.monto)}</td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={p.estado_envio}
                          onChange={(e) => setEstado(p, e.target.value as EstadoEnvio)}
                          className={`rounded-md border px-2 py-1 text-xs font-sans font-semibold outline-none ${ESTADO_CLASS[p.estado_envio]}`}
                        >
                          <option value="retiro">Retiro</option>
                          <option value="pendiente">Pendiente</option>
                          <option value="enviado">Enviado</option>
                        </select>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right text-info">
                        {p.transferencia > 0 ? `$ ${fmtMoney(p.transferencia)}` : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-success">
                        {p.efectivo > 0 ? `$ ${fmtMoney(p.efectivo)}` : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 font-sans text-muted-foreground" title={p.observaciones ?? ""}>
                        {p.observaciones || <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          {p.recibo_pdf_path && (
                            <button
                              onClick={() => downloadPdf(p.recibo_pdf_path!)}
                              title="Descargar recibo"
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
                            >
                              <FileText className="h-3 w-3" /> Recibo
                            </button>
                          )}
                          {p.transferencia_pdf_path && (
                            <button
                              onClick={() => downloadPdf(p.transferencia_pdf_path!)}
                              title="Descargar transferencia"
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
                            >
                              <Download className="h-3 w-3" /> Transf.
                            </button>
                          )}
                          {!p.recibo_pdf_path && !p.transferencia_pdf_path && (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <button
                          onClick={() => { setEditing(p); setShowForm(true); }}
                          className="mr-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(p)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "registro" : "registros"}
        </p>

        <MonthlyCharts payments={payments} />
      </div>

      {showForm && (
        <PaymentForm
          initial={editing}
          clientes={clientes}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  amount,
  color,
  isCount,
}: {
  label: string;
  amount: number;
  color?: "info" | "success";
  isCount?: boolean;
}) {
  const colorClass = color === "info" ? "text-info" : color === "success" ? "text-success" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-bold tabular ${colorClass}`}>
        {isCount ? amount : `$ ${fmtMoney(amount)}`}
      </div>
    </div>
  );
}

function MonthlyCharts({ payments }: { payments: Payment[] }) {
  const data = useMemo(() => {
    const map = new Map<string, { mes: string; vendido: number; envios: number; cantidad: number }>();
    for (const p of payments) {
      const key = p.fecha.slice(0, 7);
      const row = map.get(key) ?? { mes: key, vendido: 0, envios: 0, cantidad: 0 };
      row.vendido += Number(p.subtotal) || 0;
      row.envios += p.retira ? 0 : (Number(p.envio) || 0);
      row.cantidad += 1;
      map.set(key, row);
    }
    return Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [payments]);

  if (data.length === 0) return null;

  const formatMes = (m: string) => {
    const [y, mm] = m.split("-");
    return `${mm}/${y.slice(2)}`;
  };
  const tooltipMoney = (v: number) => `$ ${fmtMoney(v)}`;

  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold text-foreground">Resumen mensual</h2>
      <p className="mt-1 text-sm text-muted-foreground">Evolución mes a mes de todos los pagos registrados.</p>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Vendido por mes">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={60} />
              <Tooltip formatter={tooltipMoney} labelFormatter={formatMes} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="vendido" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Envíos por mes">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={60} />
              <Tooltip formatter={tooltipMoney} labelFormatter={formatMes} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="envios" fill="var(--info)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Pedidos por mes">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={40} />
              <Tooltip labelFormatter={formatMes} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="cantidad" stroke="var(--success)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function PaymentForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Payment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(initial?.fecha ?? today);
  const [cliente, setCliente] = useState(initial?.cliente ?? "");
  const [subtotal, setSubtotal] = useState<string>(initial ? String(initial.subtotal) : "");
  const [retira, setRetira] = useState(initial?.retira ?? false);
  const [transferencia, setTransferencia] = useState<string>(initial ? String(initial.transferencia) : "");
  const [efectivo, setEfectivo] = useState<string>(initial ? String(initial.efectivo) : "");
  const [observaciones, setObservaciones] = useState(initial?.observaciones ?? "");
  const [reciboFile, setReciboFile] = useState<File | null>(null);
  const [transfFile, setTransfFile] = useState<File | null>(null);
  const [reciboPath, setReciboPath] = useState<string | null>(initial?.recibo_pdf_path ?? null);
  const [transfPath, setTransfPath] = useState<string | null>(initial?.transferencia_pdf_path ?? null);
  const [saving, setSaving] = useState(false);

  const subtotalNum = Number(subtotal) || 0;
  const envio = retira ? 0 : Math.round(subtotalNum * ENVIO_PCT * 100) / 100;
  const total = subtotalNum + envio;

  const uploadFile = async (file: File, prefix: string): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (error) {
      alert("Error subiendo archivo: " + error.message);
      return null;
    }
    return path;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente.trim()) return alert("Ingresá el nombre del cliente");
    setSaving(true);

    let newReciboPath = reciboPath;
    let newTransfPath = transfPath;

    if (reciboFile) {
      const p = await uploadFile(reciboFile, "recibo");
      if (p) {
        if (reciboPath) await supabase.storage.from(BUCKET).remove([reciboPath]);
        newReciboPath = p;
      }
    }
    if (transfFile) {
      const p = await uploadFile(transfFile, "transferencia");
      if (p) {
        if (transfPath) await supabase.storage.from(BUCKET).remove([transfPath]);
        newTransfPath = p;
      }
    }

    const payload = {
      fecha,
      cliente: cliente.trim(),
      subtotal: Number(subtotal) || 0,
      envio: retira ? 0 : (Number(envio) || 0),
      monto: total,
      retira,
      transferencia: Number(transferencia) || 0,
      efectivo: Number(efectivo) || 0,
      observaciones: observaciones.trim() || null,
      recibo_pdf_path: newReciboPath,
      transferencia_pdf_path: newTransfPath,
    };

    const { error } = initial
      ? await supabase.from("payments").update(payload).eq("id", initial.id)
      : await supabase.from("payments").insert(payload);

    setSaving(false);
    if (error) {
      alert("Error al guardar: " + error.message);
      return;
    }
    onSaved();
  };

  const removeReciboPdf = async () => {
    if (reciboPath) await supabase.storage.from(BUCKET).remove([reciboPath]);
    setReciboPath(null);
    setReciboFile(null);
  };
  const removeTransfPdf = async () => {
    if (transfPath) await supabase.storage.from(BUCKET).remove([transfPath]);
    setTransfPath(null);
    setTransfFile(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="mt-8 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? "Editar pago" : "Nuevo pago"}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className="input" />
          </Field>
          <Field label="Cliente">
            <input type="text" value={cliente} onChange={(e) => setCliente(e.target.value)} required className="input" placeholder="Nombre" />
          </Field>
          <Field label="Subtotal">
            <input type="number" step="0.01" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} className="input tabular" placeholder="0.00" />
          </Field>
          <Field label={`Envío (${Math.round(ENVIO_PCT * 100)}% autom.)`}>
            <div className="input tabular flex items-center bg-muted/40">
              {retira ? <span className="text-muted-foreground">Retira</span> : <>$ {fmtMoney(envio)}</>}
            </div>
          </Field>
          <Field label="">
            <label className="mt-6 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={retira}
                onChange={(e) => setRetira(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary"
              />
              RETIRA
            </label>
          </Field>
          <Field label="Total">
            <div className="input tabular flex items-center bg-muted/40 font-semibold">
              $ {fmtMoney(total)}
            </div>
          </Field>
          <Field label="Transferencia">
            <input type="number" step="0.01" value={transferencia} onChange={(e) => setTransferencia(e.target.value)} className="input tabular" placeholder="0.00" />
          </Field>
          <Field label="Efectivo">
            <input type="number" step="0.01" value={efectivo} onChange={(e) => setEfectivo(e.target.value)} className="input tabular" placeholder="0.00" />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Observaciones">
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="input min-h-[70px]" placeholder="Otros datos..." />
          </Field>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FileField label="PDF de recibo" existing={reciboPath} file={reciboFile} onFile={setReciboFile} onRemove={removeReciboPdf} />
          <FileField label="PDF de transferencia" existing={transfPath} file={transfFile} onFile={setTransfFile} onRemove={removeTransfPdf} />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50">
            {saving ? "Guardando..." : initial ? "Guardar" : "Crear pago"}
          </button>
        </div>
      </form>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--border);
          background: var(--background);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: var(--ring);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 20%, transparent);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>}
      {children}
    </label>
  );
}

function FileField({
  label,
  existing,
  file,
  onFile,
  onRemove,
}: {
  label: string;
  existing: string | null;
  file: File | null;
  onFile: (f: File | null) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {existing && !file ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="flex items-center gap-2 truncate">
            <FileText className="h-4 w-4 text-info" />
            <span className="truncate">Archivo cargado</span>
          </span>
          <button type="button" onClick={onRemove} className="text-destructive hover:opacity-70">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:opacity-90"
        />
      )}
    </div>
  );
}
