-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "game_type" TEXT NOT NULL,
    "player_x_id" TEXT NOT NULL,
    "player_o_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "winner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moves" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_game_stats" (
    "user_id" TEXT NOT NULL,
    "game_type" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_game_stats_pkey" PRIMARY KEY ("user_id", "game_type")
);

-- CreateTable
CREATE TABLE "friend_game_records" (
    "user_a_id" TEXT NOT NULL,
    "user_b_id" TEXT NOT NULL,
    "game_type" TEXT NOT NULL,
    "wins_a" INTEGER NOT NULL DEFAULT 0,
    "wins_b" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friend_game_records_pkey" PRIMARY KEY ("user_a_id", "user_b_id", "game_type")
);

-- CreateIndex
CREATE INDEX "matches_status_idx" ON "matches"("status");

-- CreateIndex
CREATE INDEX "matches_game_type_idx" ON "matches"("game_type");

-- CreateIndex
CREATE UNIQUE INDEX "moves_match_id_position_key" ON "moves"("match_id", "position");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_player_x_id_fkey" FOREIGN KEY ("player_x_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_player_o_id_fkey" FOREIGN KEY ("player_o_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moves" ADD CONSTRAINT "moves_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moves" ADD CONSTRAINT "moves_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_game_stats" ADD CONSTRAINT "user_game_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_game_records" ADD CONSTRAINT "friend_game_records_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_game_records" ADD CONSTRAINT "friend_game_records_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
