-- AlterTable
ALTER TABLE "DocumentOp" ADD COLUMN     "seq" BIGSERIAL NOT NULL;

-- CreateIndex
CREATE INDEX "DocumentOp_documentId_seq_idx" ON "DocumentOp"("documentId", "seq");
