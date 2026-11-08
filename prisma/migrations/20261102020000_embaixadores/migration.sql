-- CreateTable
CREATE TABLE "Embaixador" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "instagramUsername" TEXT NOT NULL,
    "titulo" TEXT NOT NULL DEFAULT 'embaixadora',
    "cidade" TEXT,
    "uf" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "seguidores" INTEGER,
    "seguidoresManual" BOOLEAN NOT NULL DEFAULT false,
    "seguidoresEm" TIMESTAMP(3),
    "consultadoEm" TIMESTAMP(3),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "naInicial" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Embaixador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Embaixador_instagramUsername_key" ON "Embaixador"("instagramUsername");

-- CreateIndex
CREATE INDEX "Embaixador_ativo_uf_idx" ON "Embaixador"("ativo", "uf");
