# CRM Mail Dashboard

Dashboard Next.js 15 per la gestione CRM della casella mail `gg@verganiegasco.it`.

Live: https://home.locopeligroso.casa/dashboard/

## Stack

- **Next.js 15.3** App Router, TypeScript, basePath `/dashboard`
- **shadcn/ui** primitives only (17 components)
- **Tailwind 3.4** + tailwindcss-animate
- **better-sqlite3** read-write contro `mail-db.sqlite` (volume `openclaw_openclaw-config`)
- **lucide-react** icons

## Architettura

```
Cliente (companies.domain)
 └─ Progetto (projects.id)
    └─ Thread (threads.id)
       └─ Mail (mails.uid)
          ├─ Task (todos.id)
          ├─ Allegato (attachments.id)
          └─ Link (links.id)
```

- Categorizzazione cliente: `company_categories.category` ∈ `{client, vendor, award, newsletter, internal, unknown}`
- Task owner: `{giuseppe, team, cliente, shared}`
- Chat Napoleone per entità: `chat_threads` + `chat_messages` (one chat per entity_type+entity_id)
- Scheduler ogni 5 min (`scheduler.py`): fetch mail incrementale + reindex todos (ultimi 14gg, solo clienti)

## Pagine

- `/` Riepilogo con KPI + top clienti + task urgenti + runs
- `/clients` Elenco con filtro categoria + search
- `/clients/[domain]` Dettaglio (Tabs: Thread/Task/Allegati/Link/Persone/Progetti)
- `/projects` Elenco progetti (29 di default generati da classify)
- `/projects/[id]` Dettaglio progetto + ChatSheet Napoleone
- `/tasks` Task aperti filtrati (solo clienti, ultimi 14gg di default)
- `/threads` Conversazioni
- `/threads/[id]` Dettaglio thread
- `/attachments` Allegati **raggruppati per thread** con **anteprima + download**
- `/links` Top domini + URL completi

## API REST

- `GET /api/kpi` — KPI totali
- `GET /api/clients` — lista clienti filtrabile
- `GET /api/clients/[domain]` — dettaglio cliente
- `POST /api/clients/[domain]/category` — set category
- `GET /api/projects` — lista progetti
- `POST /api/projects` — crea progetto
- `GET /api/projects/[id]` — dettaglio progetto
- `PATCH /api/projects/[id]` — update progetto
- `POST /api/threads/[id]/project` — assegna thread a progetto
- `GET /api/threads` / `GET /api/threads/[id]`
- `GET /api/todos`
- `POST /api/todos/[id]/done` / `POST /api/todos/[id]/owner`
- `GET /api/attachments` / `GET /api/attachments/[id]/download?inline=0|1`
- `GET /api/links` / `GET /api/links?top=1` top domini
- `GET /api/chat/[entity_type]/[entity_id]` — storia chat
- `POST /api/chat/[entity_type]/[entity_id]/send` — invia messaggio a Napoleone (async via docker exec)
- `POST /api/napoleon/rewrite` — riformula testo

## Deploy

Gira dentro una VM KVM isolata (`openclaw-sandbox`, 192.168.200.10) nel homeserver Tailscale.

```bash
docker compose up -d --build
```

Volume: `openclaw_openclaw-config` (esterno, gestito da openclaw container).
Reverse proxy: nginx su host con `location /dashboard/ { proxy_pass http://192.168.200.10:3001; ... }`.

## TODO / Roadmap

- [ ] Lettura body mail (serve ALTER TABLE `mails.body_text` + IMAP fetch)
- [ ] Reply via SMTP dalla dashboard
- [ ] Task extraction più selettivo (LLM classification via Napoleone — non ogni frase è un task)
- [ ] Filtro immagini da firme mail (escludere embed inline)
- [ ] Colonne ordinabili su tutte le tabelle (SortableTable già disponibile in `components/sortable-table.tsx`)
- [ ] Accesso diretto da chat Napoleone alle entità (già struttura pronta, usare `ChatSheet`)
