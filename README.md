# Plataforma de Jogos Multiplayer

Plataforma web para jogos multiplayer (jogo da velha, forca, etc.) com cadastro de usuários, amigos e convites. Stack: backend Fastify + Prisma (PostgreSQL), frontend React + Vite, tudo rodando em Docker.

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e Docker Compose
- (Opcional) Node 22+ e npm para rodar backend/frontend localmente sem Docker

## Subir com Docker

1. Na raiz do projeto, crie um arquivo `.env` a partir do exemplo (opcional; os valores padrão já funcionam para desenvolvimento):

   ```bash
   cp .env.example .env
   ```

2. Suba os serviços:

   ```bash
   docker compose up --build
   ```
   Ou use `make reload` para reconstruir e subir.

3. Acesse:
   - **Frontend:** http://localhost:*porta* — a porta vem do `.env` (`FRONTEND_PORT`; padrão `5173`). Ex.: se `FRONTEND_PORT=6000`, use http://localhost:6000  
   - **Backend (health):** http://localhost:3000/health (apenas na rede interna; o frontend faz proxy de `/api` e `/health`)

   **Atenção:** Evite usar a porta **5000** no navegador. O Firefox (e outros) bloqueiam essa porta por segurança. Use 5173, 6000 ou outra porta configurada em `FRONTEND_PORT`.  

As migrations do Prisma são aplicadas automaticamente ao iniciar o backend.

## O que está disponível

- **Cadastro e login** – Registro com e-mail, nome de usuário e senha; login com cookies httpOnly (JWT access + refresh).
- **Perfil** – Página de perfil do usuário (dados atuais; estatísticas por jogo ficam para versões futuras).
- **Amigos** – Enviar convite por nome de usuário, listar convites recebidos, aceitar/rejeitar, listar amigos.

## Rodar sem Docker (desenvolvimento)

1. **Banco:** suba só o PostgreSQL (por exemplo `docker compose up -d db`) e use no `.env` do backend:

   ```env
   DATABASE_URL=postgresql://games:games_secret@localhost:5432/games_platform
   ```

2. **Backend:**

   ```bash
   cd backend
   npm install
   npx prisma migrate deploy
   npm run dev
   ```

   O backend ficará em http://localhost:3000.

3. **Frontend:**

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   O frontend ficará em http://localhost:5173 e usará o proxy do Vite para `/api` e `/health` (apontando para o backend em localhost:3000). Não é necessário configurar `VITE_API_URL` nesse caso.

## Variáveis de ambiente

Consulte `.env.example`. Principais:

- `POSTGRES_*` – credenciais do PostgreSQL (usadas pelo Compose e pelo backend).
- `JWT_SECRET` – segredo para assinatura dos JWTs (obrigatório em produção).
- `CORS_ORIGIN` – origin permitida pelo backend (padrão: `http://localhost:5173`).
- `FRONTEND_PORT` – porta do servidor de desenvolvimento do frontend (padrão: `5173`). Ex.: `6000`; evite `5000` (bloqueada pelo Firefox).
- No container do frontend, `API_URL` é usada pelo proxy do Vite (no Compose já está como `http://backend:3000`).

## Estrutura do repositório

```
games/
├── docker-compose.yml    # db, backend, frontend
├── .env.example
├── backend/              # Fastify + Prisma + JWT
│   ├── prisma/
│   ├── src/
│   │   ├── routes/       # auth, users, friends
│   │   └── lib/          # db, auth, validation
│   └── Dockerfile
└── frontend/             # React + Vite
    ├── src/
    │   ├── api/          # client HTTP
    │   ├── context/      # AuthContext
    │   └── pages/        # Login, Register, Home, Profile, Friends
    └── Dockerfile
```

## Próximos passos (futuro)

- Adicionar jogos (ex.: jogo da velha, forca) com WebSockets ou polling.
- Tabelas de estatísticas por jogo e por adversário.
- Convites para partidas (desafiar amigo a jogar).
