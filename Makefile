# Games Platform - Makefile de desenvolvimento
# Uso: make <target>

.PHONY: help setup up down build reload deploy dev dev-down dev-build logs shell-backend shell-db \
	backend-install backend-dev backend-build backend-db-generate backend-db-migrate backend-db-push \
	frontend-install frontend-dev frontend-build frontend-preview \
	clean

# Default: mostra ajuda
help:
	@echo "Games Platform - Comandos disponíveis:"
	@echo ""
	@echo "  Docker:"
	@echo "    make up              - Sobe todos os serviços (db, backend com migrations, frontend)"
	@echo "    make down            - Para e remove os containers"
	@echo "    make build           - Constrói as imagens Docker"
	@echo "    make reload          - Para, reconstrói imagens e sobe de novo (aplica alterações)"
	@echo "    make deploy          - Deploy produção: setup + build + up (frontend sobe após backend healthy)"
	@echo "    make dev             - Sobe em modo DEV com hot reload (backend executa migrations no start)"
	@echo "    make dev-down        - Para os containers do modo dev"
	@echo "    make dev-build       - Reconstrói imagens do modo dev (use após mudar deps)"
	@echo "    make logs            - Mostra logs de todos os serviços"
	@echo "    make shell-backend   - Abre shell no container do backend"
	@echo "    make shell-db        - Abre psql no container do banco"
	@echo "  Deploy: Se o backend não subir por migração falhada (P3009), use: make shell-backend, depois"
	@echo "    npx prisma migrate resolve --applied <migration_name> ou --rolled-back <migration_name>"
	@echo ""
	@echo "  Backend (local, em backend/):"
	@echo "    make backend-install       - npm install no backend"
	@echo "    make backend-dev           - Inicia backend em modo dev (tsx watch)"
	@echo "    make backend-build         - Compila TypeScript"
	@echo "    make backend-db-generate   - prisma generate"
	@echo "    make backend-db-migrate    - prisma migrate dev"
	@echo "    make backend-db-push       - prisma db push"
	@echo ""
	@echo "  Frontend (local, em frontend/):"
	@echo "    make frontend-install - npm install no frontend"
	@echo "    make frontend-dev     - Inicia Vite em modo dev"
	@echo "    make frontend-build   - Build de produção"
	@echo "    make frontend-preview - Preview do build"
	@echo ""
	@echo "  Outros:"
	@echo "    make setup  - Cria .env a partir de .env.example (se não existir)"
	@echo "    make clean  - Remove node_modules e builds (backend + frontend)"

# --- Setup ---
setup:
	@if [ ! -f .env ]; then cp .env.example .env && echo ".env criado a partir de .env.example"; else echo ".env já existe"; fi

# --- Docker ---
up: setup
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

reload: down
	docker compose up -d --build
	@echo "Reload concluído. Containers rodando com as novas alterações."

# --- Deploy (produção: migrations no backend, frontend só sobe quando backend está healthy) ---
deploy: setup
	docker compose down
	docker compose up -d --build
	@echo "Deploy concluído. Backend executa 'prisma migrate deploy' no start; frontend só sobe após backend healthy."

# --- Docker Dev (hot reload) ---
DEV_COMPOSE = -f docker-compose.yml -f docker-compose.dev.yml

dev: setup
	docker compose $(DEV_COMPOSE) up -d --build
	@echo "Modo dev ativo. Backend executa migrations no start; alterações em backend/ e frontend/ recarregam automaticamente."

dev-down:
	docker compose $(DEV_COMPOSE) down

dev-build:
	docker compose $(DEV_COMPOSE) build

logs:
	docker compose logs -f

shell-backend:
	docker compose exec backend sh

shell-db:
	docker compose exec db psql -U games -d games_platform

# --- Backend (local) ---
backend-install:
	cd backend && npm install

backend-dev:
	cd backend && npm run dev

backend-build:
	cd backend && npm run build

backend-db-generate:
	cd backend && npm run db:generate

backend-db-migrate:
	cd backend && npm run db:migrate

backend-db-push:
	cd backend && npm run db:push

# --- Frontend (local) ---
frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

frontend-preview:
	cd frontend && npm run preview

# --- Limpeza ---
clean:
	rm -rf backend/node_modules backend/dist frontend/node_modules frontend/dist
	@echo "Limpeza concluída."
