-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "emailConfirmadoEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LinkEmail" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "finalidade" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "destino" TEXT NOT NULL DEFAULT '/',
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkEmail_usuarioId_criadoEm_idx" ON "LinkEmail"("usuarioId", "criadoEm");

-- AddForeignKey
ALTER TABLE "LinkEmail" ADD CONSTRAINT "LinkEmail_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
