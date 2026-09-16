-- Total weight of cut-off "tops" pieces removed during a movement (mainly
-- used for Laser Sawing returns, where a stone can be cut from several
-- angles before its final weight is known).
ALTER TABLE "ProcessMovement" ADD COLUMN "topsWeight" DOUBLE PRECISION;
