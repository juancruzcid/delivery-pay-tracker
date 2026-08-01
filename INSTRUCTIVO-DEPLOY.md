# Instructivo: publicar la app en tu propio dominio con base de datos gratis

Stack: TanStack Start (React + Vite) + Supabase (base de datos, auth y storage).
Hosting recomendado: **Cloudflare Workers** (gratis, ya viene configurado el target en el build).
Base de datos: **Supabase Free** (500 MB DB + 1 GB storage, gratis).

---

## 1. Crear tu proyecto de Supabase (gratis)

1. Entrá a https://supabase.com → *Sign in with GitHub* → **New project**.
2. Nombre: `pagos-distriluk`. Elegí una región cercana (ej. `South America (São Paulo)`).
3. Guardá la **Database password** que te pide (la vas a necesitar).
4. Esperá 1-2 minutos a que termine de crearse.

### Datos que vas a necesitar (Project Settings)
- **Project URL** → `Settings → Data API` (ej. `https://abcd1234.supabase.co`)
- **Publishable / anon key** → `Settings → API Keys`
- **Project ref** → la parte `abcd1234` de la URL

---

## 2. Crear las tablas en tu Supabase

En tu repo ya están todas las migraciones en `supabase/migrations/`.

### Opción A (la más simple, sin instalar nada)
1. En Supabase abrí **SQL Editor → New query**.
2. Abrí los archivos de `supabase/migrations/` **en orden por nombre** (empiezan con la fecha) y pegá el contenido de cada uno, ejecutando uno por uno con **Run**.

### Opción B (con CLI)
```bash
npm i -g supabase
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

### Crear el bucket de archivos
En Supabase: **Storage → New bucket** → nombre `payment-docs` → **Private** (no público).
Si las políticas de storage no vinieron en las migraciones, revisá que existan en
**Storage → Policies** (lectura pública, escritura solo autenticados).

---

## 3. Crear tu usuario administrador

1. Supabase → **Authentication → Providers → Email**: activá *Enable email provider* y
   **desactivá** "Confirm email" (para no depender de mails) o dejalo activo si preferís.
2. Momentáneamente permití registros: **Authentication → Sign In / Providers → Allow new users to sign up = ON**.
3. Abrí tu app (local o ya publicada) en `/auth`, creá tu cuenta con email y contraseña.
4. Volvé a Supabase y **apagá** "Allow new users to sign up" para que nadie más pueda registrarse.

> Alternativa: **Authentication → Users → Add user** y crear el usuario a mano, sin habilitar registros.

---

## 4. Probar en tu compu (opcional pero recomendado)

En la raíz del repo creá un archivo `.env`:

```
VITE_SUPABASE_URL="https://TU_REF.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="TU_PUBLISHABLE_KEY"
VITE_SUPABASE_PROJECT_ID="TU_REF"
SUPABASE_URL="https://TU_REF.supabase.co"
SUPABASE_PUBLISHABLE_KEY="TU_PUBLISHABLE_KEY"
SUPABASE_PROJECT_ID="TU_REF"
```

```bash
npm install
npm run dev
```
Abrí http://localhost:8080 y verificá que carga y que podés loguearte.

> `.env` NO se sube a GitHub. Las variables se cargan después en el hosting.

---

## 5. Publicar en Cloudflare Workers (gratis)

1. Entrá a https://dash.cloudflare.com → **Workers & Pages → Create → Workers → Import a repository**.
2. Conectá tu cuenta de GitHub y elegí el repo del proyecto.
3. Configuración de build:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Root directory:** `/`
4. **Variables de entorno** (Settings → Variables and Secrets), agregá las 6:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`,
   `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`.
5. **Save and Deploy**. Queda online en `https://tu-proyecto.workers.dev`.

Cada `git push` a la rama principal vuelve a desplegar solo.

> **Alternativa igual de válida:** Vercel o Netlify. Importás el repo, build `npm run build`,
> cargás las mismas variables de entorno y listo. En Vercel puede requerir cambiar el target
> del build de `cloudflare` a `vercel` en la config de nitro.

---

## 6. Conectar tu propio dominio

1. Comprá el dominio (Namecheap, Cloudflare Registrar, Nic.ar, etc.).
2. Si no está en Cloudflare: en el dash de Cloudflare → **Add a site** → seguí los pasos y
   cambiá los **nameservers** en tu registrador por los que te da Cloudflare (tarda hasta 24 hs).
3. En tu Worker → **Settings → Domains & Routes → Add → Custom domain** → escribí
   `pagos.tudominio.com` (o el dominio raíz). Cloudflare crea el DNS y el certificado HTTPS solo.
4. Repetí para `www` si querés que también funcione.

---

## 7. Ajustes finales en Supabase

En **Authentication → URL Configuration**:
- **Site URL:** `https://tudominio.com`
- **Redirect URLs:** agregá `https://tudominio.com/**`

Sin esto, el login puede redirigir mal.

---

## Checklist final

- [ ] Proyecto Supabase creado y migraciones ejecutadas
- [ ] Bucket `payment-docs` creado (privado)
- [ ] Usuario admin creado y registros nuevos bloqueados
- [ ] Repo desplegado en Cloudflare Workers con las 6 variables
- [ ] Dominio propio apuntando al Worker con HTTPS
- [ ] Site URL y Redirect URLs configuradas en Supabase
- [ ] Probado: entrar sin login (solo lectura) y con login (editar, subir PDFs, informe mensual)

---

## Costos

Todo esto es **gratis**: Cloudflare Workers free (100.000 requests/día) y Supabase Free
(500 MB base + 1 GB storage). Lo único que se paga es el dominio (~10-15 USD/año).
