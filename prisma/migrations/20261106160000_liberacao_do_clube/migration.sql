-- Liberação de donos para o Clube do Bem (#248): a moderação libera quem tem CNPJ.
-- CreateTable
CREATE TABLE "LiberacaoClube" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'liberada',
    "motivo" TEXT,
    "decididoPorId" TEXT,
    "decididoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiberacaoClube_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiberacaoClube_usuarioId_idx" ON "LiberacaoClube"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "LiberacaoClube_empresaId_usuarioId_key" ON "LiberacaoClube"("empresaId", "usuarioId");

-- AddForeignKey
ALTER TABLE "LiberacaoClube" ADD CONSTRAINT "LiberacaoClube_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiberacaoClube" ADD CONSTRAINT "LiberacaoClube_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiberacaoClube" ADD CONSTRAINT "LiberacaoClube_decididoPorId_fkey" FOREIGN KEY ("decididoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

