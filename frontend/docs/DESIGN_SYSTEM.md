# Design System — JGames

Documento de referência e alinhamento para o frontend. Qualquer nova feature de UI deve consultar e, se necessário, atualizar este documento.

---

## 1. Objetivo e princípios

### Objetivo

Interface amigável e consistente no estilo **plataforma de jogos arcade**: fundo escuro, acentos com sensação de brilho/neon, cards como “tiles” de jogos, navegação clara e feedback visual em interações.

### Princípios

- **Consistência:** Usar sempre os tokens (cores, espaçamento, tipografia) e os componentes base; evitar valores fixos e estilos ad hoc.
- **Acessibilidade:** Contraste adequado (WCAG), foco visível, labels em formulários, mensagens de erro associadas aos campos.
- **Performance:** Evitar dependências pesadas; fontes e estilos mínimos necessários.
- **Manutenção:** Design tokens em CSS e componentes reutilizáveis como única fonte de verdade para aparência e comportamento.

---

## 2. Tokens de design (referência)

Definidos em `src/index.css` na `:root`.

### Cores (paleta JGames — neon / retro-futurista)

| Variável | Uso |
|----------|-----|
| `--bg-page` | Fundo principal (escuro) |
| `--bg-card` | Fundo de cards, listas e painéis |
| `--bg-elevated` | Fundo de elementos elevados (inputs, áreas sobrepostas) |
| `--text-primary` | Texto principal |
| `--text-muted` | Texto secundário, hints |
| `--accent` | Azul neon — links, destaques, bordas de foco |
| `--accent-hover` | Estado hover do accent |
| `--accent-purple` | Roxo — gradientes e destaques secundários |
| `--accent-pink` | Rosa/magenta — destaques opcionais |
| `--success` | Ações positivas (ex.: aceitar convite) |
| `--success-hover` | Hover em botões de sucesso |
| `--danger` | Erros, ações destrutivas (ex.: rejeitar) |
| `--danger-hover` | Hover em botões de perigo |
| `--border` | Bordas neutras |
| `--glow` | Brilho neon (sombra) em cards/destaques |
| `--glow-purple` | Brilho roxo opcional |
| `--gradient-accent` | Gradiente accent → roxo (botões primary) |
| `--gradient-hero` | Gradiente sutil para hero/header |

### Tipografia

| Variável | Uso |
|----------|-----|
| `--font-display` | Títulos e marca (ex.: Orbitron) |
| `--font-body` | Corpo de texto |
| `--size-xs` a `--size-2xl` | Tamanhos de fonte |
| `--weight-normal`, `--weight-bold` | Pesos de fonte |

### Espaçamento

| Variável | Valor típico | Uso |
|----------|--------------|-----|
| `--space-1` | 4px | Margens/paddings mínimos |
| `--space-2` | 8px | Entre elementos próximos |
| `--space-3` | 12px | Padding interno de componentes |
| `--space-4` | 16px | Entre blocos pequenos |
| `--space-5` | 24px | Entre seções ou padding de card |
| `--space-6` | 32px | Entre seções maiores |
| `--space-7` | 48px | Espaçamento generoso |
| `--space-8` | 64px | Margens largas (ex.: toasts) |

### Raios e sombras

| Variável | Uso |
|----------|-----|
| `--radius-sm` | Bordas levemente arredondadas (6px) |
| `--radius-md` | Botões, inputs (8px) |
| `--radius-lg` | Elementos maiores (12px) |
| `--radius-card` | Cards e painéis (16px) |
| `--shadow-card` | Sombra padrão de cards |
| `--shadow-glow` | Brilho neon opcional |
| `--shadow-glow-strong` | Brilho neon intenso |
| `--transition-fast` | 150ms — hover, focus |
| `--transition-normal` | 200ms — transições de layout |

---

## 3. Layout e estrutura

### AppLayout

- **Local:** `src/components/layout/AppLayout.tsx`
- **Uso:** Envolve todo o conteúdo das rotas protegidas. Inclui:
  - **Barra de navegação (topo):** logo (imagem em `public/logo.png`) + nome “JGames” (link para Início), links (Início, Perfil, Amigos, Jogo da Velha), notificações, nome do usuário e botão Sair.
  - **Área de conteúdo:** `<main>` com `max-width: 960px`, centralizado, padding consistente; o `<Outlet />` do React Router é renderizado aqui.

### Regras de layout

- **Páginas públicas (login, register):** não usam `AppLayout`; tela cheia com conteúdo centralizado (card único).
- **Páginas protegidas:** sempre renderizadas dentro de uma rota que usa `AppLayout`; não repetir navegação nas páginas.

### Layout mobile-first e breakpoints

- **Breakpoints:** padrão (mobile), `480px` (ajustes de padding/grids), `768px` (nav completa vs. hamburger), conteúdo `max-width: 960px`.
- **Header (AppLayout):**
  - **Desktop (≥768px):** logo + nome JGames à esquerda; nav horizontal (Início, Perfil, Amigos, Jogo da Velha), notificações, usuário e Sair à direita.
  - **Mobile (<768px):** logo + JGames à esquerda (logo mais compacta); à direita ícone de notificações e botão hamburger que abre um **drawer** (painel deslizante) com os mesmos links, nome do usuário e Sair. O drawer fecha ao clicar num link ou no fundo.
- **Main:** padding reduzido em mobile (`var(--space-4)`), aumentando em telas maiores (`var(--space-5)`, depois `var(--space-6)` lateral).
- **Áreas de toque:** botões e links interativos com **mínimo 44px** de altura/largura onde possível (navegação, formulários, ações de jogo).
- **Disposição por página:**
  - **Home:** grids de atalhos e jogos em 1 coluna no mobile; a partir de 480px, várias colunas (`auto-fill` com `minmax`).
  - **Login / Register:** card centralizado; padding da página menor no mobile; inputs e botão submit com min-height 44px.
  - **Friends:** formulário “Convidar” em coluna no mobile (input e botão full-width); a partir de 480px, linha com input flex e botão ao lado.
  - **TicTacToe Lobby:** listas já em coluna; botões “Partida rápida” e “Entrar” com área de toque 44px.
  - **TicTacToe Match:** cabeçalho com “← Lobby” e título permite quebra de linha; board centralizado com células responsivas (`clamp`); botões com altura tátil.
  - **Notificações:** painel dropdown com `max-width` limitado ao viewport no mobile (`calc(100vw - var(--space-8))`); ícone do sino com min 44px.

---

## 4. Componentes

Todos em `src/components/ui/`. Exportados via `src/components/ui/index.ts`.

### Button

- **Props principais:** `variant`, `size`, `loading`, `disabled`, e todas as props nativas de `<button>`.
- **Variantes:** `primary` (ação principal), `success` (confirmar/aceitar), `danger` (rejeitar/remover), `ghost` (secundário).
- **Tamanhos:** `sm`, `md`.
- **Uso:** Sempre que precisar de uma ação clicável; usar `type="submit"` em formulários quando for o envio.

Exemplo:

```tsx
<Button variant="primary" size="md" loading={loading} type="submit">
  Entrar
</Button>
<Button variant="danger" size="sm" onClick={handleReject}>Rejeitar</Button>
```

### Card

- **Props:** `glow?` (opcional — borda/brilho no accent), `style`, e props de `div`.
- **Uso:** Agrupar conteúdo (perfil, lista de amigos, convites, blocos na Home). Usar `glow` para destaque (ex.: card de login/cadastro).

Exemplo:

```tsx
<Card glow>Conteúdo do card</Card>
<Card style={{ padding: 'var(--space-3)' }}>Item de lista</Card>
```

### Input

- **Props:** `label` (obrigatório), `error?`, mais todas as props nativas de `<input>`.
- **Uso:** Campos de formulário; sempre com `label`; usar `error` e mensagem para validação. Acessibilidade: `aria-invalid` e `aria-describedby` quando houver erro.

Exemplo:

```tsx
<Input
  label="E-mail"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  required
/>
<Input label="Senha" type="password" error={errors.password} />
```

### PageSection

- **Props:** `title` (título da seção), `style`, e props de `<section>`.
- **Uso:** Agrupar blocos com título (ex.: “Convidar por nome de usuário”, “Convites recebidos”, “Lista de amigos”). Garante margem inferior consistente e título com fonte display.

Exemplo:

```tsx
<PageSection title="Convites recebidos">
  {invites.length === 0 ? <p>Nenhum convite.</p> : <ul>...</ul>}
</PageSection>
```

### NavLink

- **Props:** as do `NavLink` do React Router (`to`, `children`, etc.).
- **Uso:** Links de navegação que precisam de estado ativo (cor e peso diferentes). Pode ser usado no layout ou em menus; no `AppLayout` os links do topo usam estilo equivalente.

Exemplo:

```tsx
<NavLink to="/profile">Perfil</NavLink>
```

### GameStatsPills

- **Local:** `src/components/GameStatsPills.tsx` (não em `ui/`; importar como `import GameStatsPills from '../components/GameStatsPills'`).
- **Props:** `wins`, `losses`, `draws` (números); `compact?` (opcional — se `true`, usa layout compacto).
- **Variantes:** **default** — três pills em coluna (etiqueta + número), para estatísticas gerais (ex.: card "Jogo da Velha" no Perfil); **compact** — pills em linha (etiqueta e número lado a lado), menos padding, para listas (ex.: estatísticas vs. amigo na Lista de amigos).
- **Estilo:** fundo `--bg-elevated`, bordas `--radius-md`; Vitórias com cor/borda `--success`, Derrotas com `--danger`, Empates com `--border`/`--text-muted`. Inclui `aria-label` com o resumo das estatísticas.
- **Uso:** Exibir estatísticas de jogos (vitórias, derrotas, empates) de forma consistente; reutilizar em ranking ou detalhe de jogo no futuro.

Exemplo:

```tsx
<GameStatsPills wins={5} losses={2} draws={1} />
<GameStatsPills wins={1} losses={0} draws={0} compact />
```

---

## 5. Páginas e rotas

| Rota | Página | Layout | Pública |
|------|--------|--------|---------|
| `/login` | Login | Não | Sim |
| `/register` | Register | Não | Sim |
| `/` | Home | Sim | Não |
| `/profile` | Profile | Sim | Não |
| `/friends` | Friends | Sim | Não |

- **Título de página:** um único `h1` por página, com `fontFamily: 'var(--font-display)'` e margem inferior consistente.
- **Seções:** `h2` com fonte display (via `PageSection` ou estilo equivalente).

---

## 6. Estilo visual JGames (neon / retro-futurista)

- **Cores:** Fundo escuro (`--bg-page`), cards em `--bg-card`; acentos em azul neon (`--accent`, `--glow`); gradientes accent → roxo; sucesso em verde, perigo em vermelho.
- **Tipografia:** Títulos com `--font-display` (Orbitron); corpo com `--font-body`; bordas arredondadas nos componentes.
- **Sombras e brilho:** Cards com `--shadow-card`; opcionalmente `--shadow-glow` ou borda + glow com `--accent` para “tiles” em destaque; botões primary com gradiente e leve glow.
- **Animações:** Transições curtas (`--transition-fast` / `--transition-normal`) em hover e focus; evitar animações longas ou excessivas.

---

## 7. Acessibilidade e boas práticas

- **Contraste:** Manter texto e fundos com contraste adequado (referência WCAG 2.1 AA).
- **Foco:** Sempre foco visível em links e botões (`outline` com `--accent` em `:focus-visible`).
- **Formulários:** Todo campo com `<label>` associado; mensagens de erro com `role="alert"` e associação ao campo (`aria-describedby` / `id`).
- **Botões:** Não desativar sem feedback; usar estado `loading` quando a ação for assíncrona.

---

## 8. Convenções de código

- **Novos componentes:**
  - **UI genérica:** `src/components/ui/` — botões, inputs, cards, etc.
  - **Layout:** `src/components/layout/` — AppLayout e possíveis variações.
  - **Feature:** `src/components/<feature>/` ou dentro da página se for uso único.
- **Estilos:** Preferir variáveis CSS (`var(--...)`) em vez de valores fixos (hex, px soltos). Evitar estilos inline exceto para valores dinâmicos (ex.: width em %). Para novos componentes, usar classes em `index.css` ou CSS Modules se o projeto adoptar.
- **Imports:** Componentes UI via `import { Button, Card, ... } from '../components/ui'`.

---

## 9. Extensões futuras (parametrizações)

- **Temas:** Todas as cores vêm de tokens; um segundo tema (ex.: “light”) pode ser implementado sob outra `:root` ou `[data-theme="light"]` redefinindo as variáveis.
- **i18n:** Manter textos extraíveis (chaves) para tradução; não hardcodar strings longas em componentes sem planejar i18n.
- **Novas páginas:** “Detalhe de jogo”, “Lobby”, “Ranking” — usar sempre `AppLayout` e os componentes do design system; seguir o padrão de um `h1` por página e `PageSection` ou `h2` para seções.
- **Animações:** Definir duração padrão (`--transition-fast` / `--transition-normal`) e usar de forma consistente em hover, loading e transições de página; evitar duração maior sem justificativa.

---

*Última atualização: marca JGames, logo, tokens neon/retro-futurista, layout mobile-first.*
