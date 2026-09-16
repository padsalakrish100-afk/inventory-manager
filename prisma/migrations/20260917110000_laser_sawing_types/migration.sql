-- AlterEnum: Laser Sawing is really three distinct machines with their own
-- pricing — Green, Quasar, and Waterjet sawing. Renaming preserves any
-- existing LASER_SAWING rows under the Green Sawing name (no rows existed
-- at the time of this migration); the other two are new values.
ALTER TYPE "ProcessName" RENAME VALUE 'LASER_SAWING' TO 'GREEN_SAWING';
ALTER TYPE "ProcessName" ADD VALUE 'QUASAR_SAWING' AFTER 'GREEN_SAWING';
ALTER TYPE "ProcessName" ADD VALUE 'WATERJET_SAWING' AFTER 'QUASAR_SAWING';
