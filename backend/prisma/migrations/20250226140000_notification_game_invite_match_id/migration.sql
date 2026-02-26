-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "match_id" TEXT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
