-- Total price paid for the whole rough lot — used to auto-allocate a rough
-- cost share to each polished stone, proportional to its rough weight.
ALTER TABLE "Lot" ADD COLUMN "purchaseCost" DOUBLE PRECISION;
