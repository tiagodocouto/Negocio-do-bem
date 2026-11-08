-- Cadastro por etapas (#190): telefone comercial do negócio e o contato de quem
-- cadastrou o negócio como dono.
-- IF NOT EXISTS: o banco dos previews já recebeu estas colunas por uma versão
-- anterior desta migração (20261031130000_contatos_do_dono), renomeada para ficar
-- depois da 20261031140000_telefone.
ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "telefoneComercial" TEXT,
ADD COLUMN IF NOT EXISTS "emailDoDono" TEXT,
ADD COLUMN IF NOT EXISTS "telefoneDoDono" TEXT;
