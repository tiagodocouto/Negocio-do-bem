-- CreateTable
CREATE TABLE "TentativaAcesso" (
    "chave" TEXT NOT NULL,
    "contagem" INTEGER NOT NULL,
    "janelaIniciadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TentativaAcesso_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE INDEX "TentativaAcesso_janelaIniciadaEm_idx" ON "TentativaAcesso"("janelaIniciadaEm");
