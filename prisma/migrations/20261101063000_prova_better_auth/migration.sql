ALTER TABLE "Usuario"
  ADD COLUMN "emailVerificado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "imagem" TEXT;

ALTER TABLE "Sessao"
  ADD COLUMN "token" TEXT,
  ADD COLUMN "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "ip" TEXT,
  ADD COLUMN "userAgent" TEXT;
CREATE UNIQUE INDEX "Sessao_token_key" ON "Sessao"("token");

CREATE TABLE "VinculoAuth" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contaId" TEXT NOT NULL,
  "provedorId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "senha" TEXT,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiraEm" TIMESTAMP(3),
  "refreshTokenExpiraEm" TIMESTAMP(3),
  "escopo" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "VinculoAuth_provedorId_contaId_key" ON "VinculoAuth"("provedorId", "contaId");
CREATE INDEX "VinculoAuth_usuarioId_idx" ON "VinculoAuth"("usuarioId");

CREATE TABLE "VerificacaoAuth" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identificador" TEXT NOT NULL,
  "valor" TEXT NOT NULL,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "VerificacaoAuth_identificador_idx" ON "VerificacaoAuth"("identificador");

UPDATE "Usuario" SET "emailVerificado" = ("emailConfirmadoEm" IS NOT NULL);
INSERT INTO "VinculoAuth" ("id", "contaId", "provedorId", "usuarioId", "senha")
SELECT 'credential:' || "id", "id", 'credential', "id", "senhaHash"
FROM "Usuario" WHERE "senhaHash" IS NOT NULL;
INSERT INTO "VinculoAuth" ("id", "contaId", "provedorId", "usuarioId")
SELECT 'google:' || "id", "googleId", 'google', "id"
FROM "Usuario" WHERE "googleId" IS NOT NULL;
