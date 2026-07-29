# PLAN.md — Plano Técnico: Buzzie

> Documento de planeamento técnico, derivado das decisões registadas em [CLAUDE.md](./CLAUDE.md).
> Este documento **não contém código de aplicação** — apenas esquema de dados, estrutura de pastas, prioridades e ordem de construção. Onde aparece SQL ou TypeScript, é apenas ilustrativo do schema, não implementação.

---

## 1. Resumo do projeto (para confirmação)

Isto é uma ferramenta **interna** para a equipa de marketing da GenOS gerir a produção de posts para LinkedIn, Instagram e X — desde a ideia até à publicação manual.

Pontos-chave que percebi:

- **Não publica nada.** Não há integração com as APIs das redes sociais. "Scheduled" e "Published" são apenas etiquetas de estado; a publicação real é manual, fora da app.
- **Um quadro partilhado**, sem hierarquia de permissões — qualquer pessoa da equipa pode editar qualquer post. O login (Google, restrito ao domínio da empresa) serve para saber *quem fez o quê*, não para restringir acesso.
- **Um post** é composto por: plataforma, texto, imagem(ns), estado (coluna do quadro), responsável (assignee), data-alvo (opcional), categorias (múltiplas).
- **Duas vistas sobre o mesmo conjunto de posts**: Board (Kanban, 7 colunas) e Calendário (mensal) — não são bases de dados diferentes, é o mesmo post visto de duas formas, trocadas por um switcher de tabs numa única página (não empilhadas, não páginas separadas na navegação).
- **7 colunas fixas**: Backlog → Writing → Designing → In Review → Approved → Scheduled → Published. Não haverá coluna dedicada a "Changes Requested" — isso é sinalizado de outra forma (ver secção 2).
- **Categorias** são filtros, não estados — um post pode ter várias em simultâneo.
- **Comentários**: cada post tem a sua própria thread de comentários, e existe também um espaço de comentários gerais (não ligados a nenhum post) para avisos/ideias da equipa.
- **Preview**: um modal dedicado, aberto ao clicar num post — imagem + texto completo, separado do formulário de edição.
- **Stack fixa**: Next.js (TS) + shadcn/ui + Supabase (Postgres + Auth) + Vercel + `@hello-pangea/dnd`.

Se isto não corresponder ao que tens em mente, diz já antes de eu avançar para os detalhes.

---

## 2. Modelo de dados (Supabase / Postgres)

### Decisões tomadas nesta sessão (fora do CLAUDE.md original)

| Ponto em aberto no CLAUDE.md | Decisão para este plano |
|---|---|
| Comentários entre membros da equipa (Open Question #6) | **Sim, vão existir.** Uma única tabela `comments` com `post_id` opcional: preenchido = comentário desse post; `null` = comentário geral da equipa, não ligado a nenhum post. |
| Um post pode ter mais do que uma imagem? (Open Question #5) | **Sim.** Desenhado desde já como relação 1-para-muitos (`post_images`), para não obrigar a migração futura. |
| Link para o post publicado (parte da Open Question #6) | **Incluído** — campo `published_url` em `posts`. |
| "Quem pediu" vs "quem está a construir" (parte da Open Question #6) | **Incluído** — campo `requested_by_id`, distinto de `assignee_id`. |
| "Changes Requested": coluna ou flag? (Open Question #4) | **Flag booleana** (`needs_changes`) no post, independente da coluna/estado em que está. |
| Onde vive o preview do post? | **Modal dedicado**, aberto ao clicar num post — não inline no card, não misturado no formulário de edição. |

### Diagrama de relações (texto)

```
auth.users (Supabase Auth)
   └─ profiles (1:1)
        ├─ posts.assignee_id      (1 profile : N posts, como responsável)
        ├─ posts.requested_by_id  (1 profile : N posts, como requisitante)
        └─ posts.created_by       (1 profile : N posts, autoria)

posts
  ├─ post_images        (1 post : N imagens)
  ├─ post_categories    (N posts : N categorias, via tabela de junção)
  └─ comments           (1 post : N comentários; post_id pode ser null = comentário geral)
categories
  └─ post_categories
profiles
  └─ comments.author_id (1 profile : N comentários)
```

### Enums

```sql
create type platform_enum as enum ('linkedin', 'instagram', 'x');

create type post_status as enum (
  'backlog',
  'writing',
  'designing',
  'in_review',
  'approved',
  'scheduled',
  'published'
);
```

### `profiles`

Estende `auth.users` do Supabase (criado automaticamente após o login Google). Serve para ter nome/avatar disponíveis sem expor a tabela `auth.users`.

```sql
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text not null,
  avatar_url  text,
  created_at  timestamptz not null default now()
);
```

### `posts`

```sql
create table posts (
  id               uuid primary key default gen_random_uuid(),
  platform         platform_enum not null,
  title            text not null default '', -- etiqueta curta interna, só para identificar o post no quadro; nunca é publicada
  description      text not null default '', -- a copy real do post; é isto que é publicado, com limite de caracteres por plataforma
  status           post_status not null default 'backlog',
  target_date      date,                          -- opcional; obrigatório ao entrar em 'scheduled' (regra de app, não de DB)
  needs_changes    boolean not null default false, -- flag "changes requested", independente do status
  published_url    text,                           -- preenchido manualmente quando published
  assignee_id      uuid references profiles(id),
  requested_by_id  uuid references profiles(id),
  created_by       uuid not null references profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_posts_status      on posts(status);
create index idx_posts_target_date on posts(target_date);
create index idx_posts_assignee    on posts(assignee_id);
create index idx_posts_platform    on posts(platform);
```

Nota: o limite de caracteres por plataforma (LinkedIn 3000 / Instagram 2200 / X 280) é validado na **aplicação** (formulário), não como `CHECK` na base de dados — evita ter de alterar o schema se os limites das plataformas mudarem.

### `post_images` (1 post : N imagens)

```sql
create table post_images (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  image_url  text not null,
  position   int not null default 0,   -- ordem de exibição, se houver mais que uma
  created_at timestamptz not null default now()
);

create index idx_post_images_post on post_images(post_id);
```

### `categories`

```sql
create table categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);
```

### `post_categories` (N post : N categorias)

```sql
create table post_categories (
  post_id     uuid not null references posts(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (post_id, category_id)
);

create index idx_post_categories_category on post_categories(category_id);
```

### `comments` (1 post : N comentários, ou geral se `post_id` for `null`)

```sql
create table comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references posts(id) on delete cascade, -- null = comentário geral da equipa
  author_id  uuid not null references profiles(id),
  body       text not null,
  created_at timestamptz not null default now()
);

create index idx_comments_post on comments(post_id);
```

Nota: como um comentário geral não pertence a nenhum post, apagar um post (`on delete cascade`) só arrasta os comentários desse post — os gerais não são afetados.

### Row Level Security (RLS)

Como o acesso é controlado no login (Google restrito ao domínio da empresa) e todos têm permissões iguais, a política é simples: qualquer utilizador autenticado pode ler/escrever em todas as tabelas.

```sql
alter table posts enable row level security;
alter table post_images enable row level security;
alter table categories enable row level security;
alter table post_categories enable row level security;
alter table comments enable row level security;
alter table profiles enable row level security;

create policy "authenticated users can do everything"
  on posts for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
-- repetir política equivalente para as restantes tabelas
```

### Tipos TypeScript ilustrativos

```ts
type Platform = 'linkedin' | 'instagram' | 'x'
type PostStatus =
  | 'backlog' | 'writing' | 'designing'
  | 'in_review' | 'approved' | 'scheduled' | 'published'

interface Profile {
  id: string
  fullName: string | null
  email: string
  avatarUrl: string | null
}

interface PostImage {
  id: string
  postId: string
  imageUrl: string
  position: number
}

interface Category {
  id: string
  name: string
}

interface Post {
  id: string
  platform: Platform
  title: string
  description: string
  status: PostStatus
  targetDate: string | null
  needsChanges: boolean
  publishedUrl: string | null
  assignee: Profile | null
  requestedBy: Profile | null
  images: PostImage[]
  categories: Category[]
  createdAt: string
  updatedAt: string
}

interface Comment {
  id: string
  postId: string | null   // null = comentário geral, não ligado a um post
  author: Profile
  body: string
  createdAt: string
}
```

---

## 3. Estrutura de pastas sugerida (Next.js + TypeScript)

> Nota: o [AGENTS.md](./AGENTS.md) avisa que esta versão do Next.js pode ter convenções diferentes do habitual — confirmar contra `node_modules/next/dist/docs/` já quando a implementação começar. A estrutura abaixo é a convenção "App Router" standard; pode precisar de ajustes.

```
app/
  layout.tsx                  # layout raiz, providers (auth, tema)
  page.tsx                    # redireciona para /board
  login/
    page.tsx                  # ecrã de login Google
  (dashboard)/
    layout.tsx                # header + tabs "Board | Calendar" + filter bar, partilhado pelas duas vistas
    board/
      page.tsx                # conteúdo: Kanban
    calendar/
      page.tsx                # conteúdo: Calendário mensal
  posts/
    [id]/
      page.tsx                # edição completa de um post (preview vive num modal, não aqui)
  middleware.ts                # guarda de autenticação por rota

components/
  ui/                         # componentes gerados pelo shadcn/ui
  board/
    Board.tsx
    Column.tsx
    PostCard.tsx
  calendar/
    CalendarView.tsx
    DayCell.tsx
    DayPostsPopover.tsx
  posts/
    PostForm.tsx
    PostPreviewModal.tsx      # modal aberto ao clicar num post: imagem + texto completo
    CategoryPicker.tsx
    ImageUploader.tsx
    CharacterCounter.tsx
  comments/
    CommentThread.tsx         # comentários de um post específico
    GeneralComments.tsx       # mural de comentários gerais (post_id = null)
    CommentForm.tsx
  filters/
    FilterBar.tsx
  layout/
    Header.tsx
    ViewTabs.tsx               # switcher Board | Calendar

lib/
  supabase/
    client.ts                 # cliente Supabase (browser)
    server.ts                 # cliente Supabase (server components/actions)
  queries/
    posts.ts
    categories.ts
    profiles.ts
    comments.ts
  utils/
    platformLimits.ts         # mapa plataforma -> limite de caracteres
    dates.ts

types/
  database.ts                 # tipos gerados pelo Supabase CLI
  index.ts                    # tipos de domínio (Post, Category, etc.)

hooks/
  usePosts.ts
  useCategories.ts

public/
  ...
```

---

## 4. Funcionalidades por prioridade

### v1 — essencial

- Login Google restrito ao domínio da empresa (via Supabase Auth)
- CRUD de posts: plataforma, texto, imagem(ns), responsável, requisitante, data-alvo, categorias
- Vista Board (Kanban, 7 colunas, drag-and-drop com `@hello-pangea/dnd`)
- Vista Calendário (mensal), a partir do mesmo conjunto de posts
- Gestão de categorias (criar/editar) + atribuição múltipla a um post
- Filtros por plataforma, data e categoria (aplicados a ambas as vistas)
- Contador de caracteres por plataforma no formulário (aviso de limite, não bloqueio rígido)
- Data obrigatória ao arrastar um post para "Scheduled" sem data
- Flag "needs changes" no post (badge visível no card, independente da coluna)
- `published_url` — campo simples para colar o link depois de publicado manualmente
- Preview num modal dedicado (aberto ao clicar num post): imagem + texto completo lado a lado, sem mockup fiel por plataforma
- Comentários por post (thread) + mural de comentários gerais da equipa (não ligados a um post)

### v2 / mais tarde (fora do v1)

- Suporte a múltiplas plataformas no mesmo post (só se a Open Question #1 for confirmada nesse sentido)
- Método de login alternativo, caso o Google não seja aprovado
- Preview fiel por plataforma (truncamento exato de legendas, etc.)
- Notificações / registo de atividade ("quem moveu isto para Approved")
- Qualquer modelo de permissões mais granular (atualmente rejeitado, mas a manter em mente)

---

## 5. Ordem de construção sugerida (milestones)

1. **Scaffolding + Supabase + Auth** — projeto Next.js, ligação ao Supabase, login Google restrito ao domínio a funcionar de ponta a ponta. Nada mais funciona sem isto, e é o maior risco técnico/de decisão (Open Question #2), por isso valida-se primeiro.
2. **Schema + RLS** — criar as tabelas (`profiles`, `posts`, `post_images`, `categories`, `post_categories`, `comments`) e políticas de acesso. Base de tudo o resto.
3. **CRUD de posts (sem board/calendário)** — formulário de criar/editar post com todos os campos, ligado à base de dados. Valida que o modelo de dados está correto antes de construir UI mais complexa em cima dele.
4. **Vista Board (Kanban)** — colunas fixas, drag-and-drop, regra de data obrigatória ao mover para Scheduled. Já construída dentro do layout partilhado (header + tabs Board/Calendar) para o switcher existir desde já.
5. **Vista Calendário** — reaproveita os mesmos posts e queries do Board; troca de conteúdo por baixo dos mesmos tabs.
6. **Filtros** (plataforma, data, categoria) — aplicados a ambas as vistas, já que ambas partilham a mesma fonte de dados.
7. **Categorias** — UI de gestão (criar categorias) e seletor múltiplo no formulário de post.
8. **Preview + Comentários** — modal de preview (imagem + texto) ao clicar num post; thread de comentários por post; mural de comentários gerais.
9. **Polimento**: badge "needs changes", contador de caracteres, campo `published_url`.
10. **Deploy Vercel** — ligação ao repositório GitHub, variáveis de ambiente Supabase, QA final com a equipa.

Lógica da ordem: primeiro o que nada mais pode funcionar sem (auth + schema), depois provar que os dados fluem corretamente com um CRUD simples, só depois construir as duas vistas principais (que são "apenas" leituras diferentes dos mesmos dados), e só no fim os filtros, comentários/preview e o polimento — que dependem de tudo o resto já existir.

---

## 6. Perguntas em aberto antes de começar a programar

Estas ainda não têm resposta definitiva e podem alterar o schema ou o scope do v1:

1. **Uma plataforma por post, ou várias?** O plano assume **uma** (conforme "decisions log" do CLAUDE.md), mas o documento marca isto como "a confirmar". Se mudar para várias, `posts.platform` deixa de poder ser um enum simples numa coluna — precisaria de virar uma relação N:N ou de duplicar posts por plataforma.
2. **Confirmação final do login Google** (domínio da empresa) vs. alternativa. O plano assume Google, mas está pendente.
3. **Lista final de categorias** — os exemplos dados (Meet the Team, Internal, GenOS) são só exemplos; falta a lista real a usar como seed inicial.

Assim que tiveres respostas para estas três, o plano pode ser ajustado antes de passar à implementação.
