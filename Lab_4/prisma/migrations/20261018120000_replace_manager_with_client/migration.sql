-- Lab 4: роль MANAGER замінюється на CLIENT; посилання Client↔User (власник замовлень)
ALTER TYPE "Role" RENAME VALUE 'MANAGER' TO 'CLIENT';
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CLIENT';

ALTER TABLE "Client" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "Client_userId_key" ON "Client"("userId");
ALTER TABLE "Client"
  ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
