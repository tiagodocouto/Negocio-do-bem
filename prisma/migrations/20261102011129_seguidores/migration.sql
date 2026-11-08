-- Seguir negócios (Clube do Bem, #248): quem segue cada negócio.
-- CreateTable
CREATE TABLE "EmpresaSeguidor" (
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmpresaSeguidor_pkey" PRIMARY KEY ("empresaId","usuarioId")
);

-- CreateIndex
CREATE INDEX "EmpresaSeguidor_usuarioId_criadoEm_idx" ON "EmpresaSeguidor"("usuarioId", "criadoEm");

-- AddForeignKey
ALTER TABLE "EmpresaSeguidor" ADD CONSTRAINT "EmpresaSeguidor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaSeguidor" ADD CONSTRAINT "EmpresaSeguidor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
