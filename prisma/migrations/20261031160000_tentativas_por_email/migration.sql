-- AlterTable
ALTER TABLE "TentativaAcesso" ADD COLUMN     "email" TEXT;

-- CreateIndex
CREATE INDEX "TentativaAcesso_email_idx" ON "TentativaAcesso"("email");
