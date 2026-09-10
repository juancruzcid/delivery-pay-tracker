import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "payment-docs";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type AnalizarResult = {
  analizados: number;
  items: number;
  pendientes: number;
  errores: string[];
};

export const analizarPedidos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<AnalizarResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { extractText, getDocumentProxy } = await import("unpdf");

    const { data: pagos } = await supabaseAdmin
      .from("payments")
      .select("id, cliente, fecha, recibo_pdf_path")
      .not("recibo_pdf_path", "is", null)
      .order("fecha", { ascending: false });

    const { data: yaHechos } = await supabaseAdmin.from("pedido_items").select("payment_id");
    const hechos = new Set((yaHechos ?? []).map((r) => r.payment_id));

    const pendientesTodos = (pagos ?? []).filter((p) => !hechos.has(p.id));
    const lote = pendientesTodos.slice(0, 10);

    const errores: string[] = [];
    let items = 0;
    let analizados = 0;

    for (const p of lote) {
      try {
        const { data: file, error } = await supabaseAdmin.storage.from(BUCKET).download(p.recibo_pdf_path!);
        if (error || !file) throw new Error("no se pudo descargar el PDF");

        const buf = new Uint8Array(await file.arrayBuffer());
        const pdf = await getDocumentProxy(buf);
        const { text } = await extractText(pdf, { mergePages: true });
        const texto = (text || "").slice(0, 12000).trim();
        if (!texto) throw new Error("el PDF no tiene texto legible");

        const res = await fetch(AI_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-lite",
            messages: [
              {
                role: "system",
                content:
                  "Extraés los productos de un pedido. Respondé SOLO un JSON con la forma {\"items\":[{\"producto\":\"nombre normalizado en minúsculas\",\"cantidad\":number,\"categoria\":\"categoria\"}]}. La categoria debe ser una sola de: 'bebidas','alimentos','lacteos','panaderia','limpieza','snacks','otros'. Ignorá totales, envíos, impuestos y datos del cliente. Si no hay productos devolvé {\"items\":[]}.",
              },
              { role: "user", content: texto },
            ],
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          if (res.status === 429) throw new Error("demasiadas consultas seguidas, probá de nuevo en un minuto");
          if (res.status === 402) throw new Error("se agotaron los créditos de IA");
          throw new Error(`IA ${res.status}: ${body.slice(0, 120)}`);
        }

        const json = (await res.json()) as any;
        const raw = json?.choices?.[0]?.message?.content ?? "";
        const match = raw.match(/\{[\s\S]*\}/);
        const parsed = match ? JSON.parse(match[0]) : { items: [] };
        const cats = ["bebidas","alimentos","lacteos","panaderia","limpieza","snacks","otros"];
        const rows = (parsed.items ?? [])
          .filter((i: any) => i?.producto)
          .map((i: any) => ({
            payment_id: p.id,
            producto: String(i.producto).trim().toLowerCase().slice(0, 120),
            cantidad: Number(i.cantidad) > 0 ? Number(i.cantidad) : 1,
            categoria: cats.includes(String(i.categoria).toLowerCase()) ? String(i.categoria).toLowerCase() : "otros",
          }));

        if (rows.length) {
          const { error: insErr } = await supabaseAdmin.from("pedido_items").insert(rows);
          if (insErr) throw new Error(insErr.message);
          items += rows.length;
        } else {
          await supabaseAdmin
            .from("pedido_items")
            .insert([{ payment_id: p.id, producto: "(sin productos detectados)", cantidad: 0, categoria: "otros" }]);
        }
        analizados++;
      } catch (e: any) {
        errores.push(`${p.cliente} ${p.fecha}: ${e?.message ?? e}`);
      }
    }

    return {
      analizados,
      items,
      pendientes: Math.max(pendientesTodos.length - analizados, 0),
      errores,
    };
  });
