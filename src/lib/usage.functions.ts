import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UsageStats = {
  rows: number;
  dbBytesEstimated: number;
  storageBytes: number;
  files: number;
  oldestMonth: string | null;
  byMonth: { mes: string; pedidos: number; archivos: number; bytes: number }[];
};

const BUCKET = "payment-docs";

export const getUsageStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<UsageStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rowsData } = await supabaseAdmin
      .from("payments")
      .select("fecha, observaciones, recibo_pdf_path, transferencia_pdf_path");

    const rows = rowsData ?? [];

    // Estimación de peso en base de datos: ~350 bytes fijos por fila + textos.
    const dbBytesEstimated = rows.reduce(
      (acc, r) => acc + 350 + (r.observaciones?.length ?? 0) + (r.recibo_pdf_path?.length ?? 0) + (r.transferencia_pdf_path?.length ?? 0),
      0,
    );

    // Recorrido del bucket (raíz + carpetas de primer nivel)
    type Entry = { name: string; size: number };
    const files: Entry[] = [];

    const listDir = async (prefix: string, depth: number) => {
      const { data } = await supabaseAdmin.storage.from(BUCKET).list(prefix, { limit: 1000 });
      for (const item of data ?? []) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        const size = (item as any)?.metadata?.size as number | undefined;
        if (size != null) files.push({ name: path, size });
        else if (depth < 3) await listDir(path, depth + 1);
      }
    };
    await listDir("", 0);

    const storageBytes = files.reduce((a, f) => a + f.size, 0);

    const pathSize = new Map(files.map((f) => [f.name, f.size]));
    const monthMap = new Map<string, { pedidos: number; archivos: number; bytes: number }>();
    for (const r of rows) {
      const mes = (r.fecha ?? "").slice(0, 7);
      if (!mes) continue;
      const cur = monthMap.get(mes) ?? { pedidos: 0, archivos: 0, bytes: 0 };
      cur.pedidos += 1;
      for (const p of [r.recibo_pdf_path, r.transferencia_pdf_path]) {
        if (!p) continue;
        cur.archivos += 1;
        cur.bytes += pathSize.get(p) ?? 0;
      }
      monthMap.set(mes, cur);
    }

    const byMonth = Array.from(monthMap.entries())
      .map(([mes, v]) => ({ mes, ...v }))
      .sort((a, b) => b.mes.localeCompare(a.mes));

    return {
      rows: rows.length,
      dbBytesEstimated,
      storageBytes,
      files: files.length,
      oldestMonth: byMonth.length ? byMonth[byMonth.length - 1].mes : null,
      byMonth,
    };
  });
