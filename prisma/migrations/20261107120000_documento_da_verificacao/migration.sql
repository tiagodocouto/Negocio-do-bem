-- Verificação do negócio (#293, parte 2): as chaves dos documentos (RG ou CNH) guardados num
-- bucket R2 privado. Ficam só enquanto o pedido espera a moderação.
-- AlterTable
ALTER TABLE "LiberacaoClube" ADD COLUMN "documentoChaves" TEXT[] DEFAULT ARRAY[]::TEXT[];
