-- Endereços antigos dos negócios (#298): o @ trocado redireciona para o atual.
-- CreateTable
CREATE TABLE "EnderecoAntigo" (
    "endereco" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnderecoAntigo_pkey" PRIMARY KEY ("endereco")
);

-- CreateIndex
CREATE INDEX "EnderecoAntigo_empresaId_idx" ON "EnderecoAntigo"("empresaId");

-- AddForeignKey
ALTER TABLE "EnderecoAntigo" ADD CONSTRAINT "EnderecoAntigo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
