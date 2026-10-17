# Lab 2 — «Сервіс ремонту та обслуговування комп'ютерної техніки»
# Образ додатка: Node 24 + Express 5 + Pug + Prisma 7 (driver adapter, без binary engine).
#
# Збірка:  docker compose up --build   (або: docker build -t lab2-service .)
# Запуск на іншому ПК: клон → Docker Desktop → docker compose up --build -d
# При кожному старті контейнера: міграції → seed (ідемпотентний, 60/30/45) → сервер.

FROM node:24-bookworm-slim

WORKDIR /app

# 1) Залежності за lockfile (npm ci — детерміновано; devDeps теж: tsx для seed, prisma CLI)
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma7.config.ts ./
RUN npm ci

# 2) Генерація Prisma-клієнта (output: generated/prisma — у .gitignore, тому збираємо в образі)
RUN npx prisma generate

# 3) Код додатка
COPY . .

# 4) Каталог завантажень — від імені node, томи успадковують власника з образу (D42)
RUN mkdir -p /app/uploads && chown node:node /app/uploads

# 5) Не-root користувач (node:slim має користувача node)
USER node

EXPOSE 3000

# Міграції (migrate deploy — production-режим) → демо-дані → сервер
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && npm start"]
