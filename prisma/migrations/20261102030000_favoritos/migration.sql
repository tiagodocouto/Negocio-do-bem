-- Seguir virou favoritar (#248): a tabela da migração 20261102011129_seguidores
-- muda de nome. Aquela já foi aplicada no banco dos previews, por isso não foi
-- editada. Renomear a chave primária renomeia também o índice dela.
ALTER TABLE "EmpresaSeguidor" RENAME TO "EmpresaFavorita";
ALTER TABLE "EmpresaFavorita" RENAME CONSTRAINT "EmpresaSeguidor_pkey" TO "EmpresaFavorita_pkey";
ALTER TABLE "EmpresaFavorita" RENAME CONSTRAINT "EmpresaSeguidor_empresaId_fkey" TO "EmpresaFavorita_empresaId_fkey";
ALTER TABLE "EmpresaFavorita" RENAME CONSTRAINT "EmpresaSeguidor_usuarioId_fkey" TO "EmpresaFavorita_usuarioId_fkey";
ALTER INDEX "EmpresaSeguidor_usuarioId_criadoEm_idx" RENAME TO "EmpresaFavorita_usuarioId_criadoEm_idx";
