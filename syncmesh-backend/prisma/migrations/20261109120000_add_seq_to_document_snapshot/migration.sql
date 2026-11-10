-- AlterTable
ALTER TABLE "DocumentSnapshot" ADD COLUMN     "seq" BIGINT NOT NULL;

-- CreateIndex
CREATE INDEX "DocumentSnapshot_documentId_seq_idx" ON "DocumentSnapshot"("documentId", "seq");
