#!/bin/sh
set -e

echo "Running database migrations..."
if ! npx prisma migrate deploy; then
  echo "Migration failed. Check _prisma_migrations and use: npx prisma migrate resolve --applied <name> or --rolled-back <name>. See https://pris.ly/d/migrate-resolve"
  exit 1
fi

echo "Migrations applied. Starting application..."
exec node dist/index.js
