-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "telefone" TEXT;

-- CreateTable
CREATE TABLE "CadastroGoogle" (
    "id" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "destino" TEXT NOT NULL DEFAULT '/',
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CadastroGoogle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CadastroGoogle_expiraEm_idx" ON "CadastroGoogle"("expiraEm");
