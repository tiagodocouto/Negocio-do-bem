-- Verificação do negócio (#293): o pedido do clube passa a levar o nome completo e o CPF
-- mascarado (só os 6 dígitos do meio, como a Receita mostra dos sócios) de quem pede.
-- AlterTable
ALTER TABLE "LiberacaoClube" ADD COLUMN "nomeCompleto" TEXT,
ADD COLUMN "cpfMascarado" TEXT;
