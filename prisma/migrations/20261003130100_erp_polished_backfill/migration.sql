-- Backfill for polished stock (20261003130000_erp_polished). Writes only new
-- columns/tables; the original shape and measurements text are kept.

-- Default antique/specialty cut attributes (editable in Settings).
INSERT INTO "AttributeDefinition" ("id", "cutStyle", "key", "label", "type", "options", "sortOrder") VALUES
  ('attr_crown_height', NULL, 'crown_height', 'Crown height impression', 'SELECT', ARRAY['Low', 'Medium', 'High', 'Very high'], 10),
  ('attr_culet_size',   NULL, 'culet_size',   'Culet size',              'SELECT', ARRAY['None', 'Pointed', 'Very small', 'Small', 'Medium', 'Large', 'Very large'], 20),
  ('attr_open_culet',   NULL, 'open_culet',   'Open culet',              'BOOLEAN', ARRAY[]::text[], 30),
  ('attr_facet_pattern',NULL, 'facet_pattern','Facet pattern',           'TEXT', ARRAY[]::text[], 40),
  ('attr_look',         NULL, 'look',         'Look / character',        'TEXT', ARRAY[]::text[], 50),
  ('attr_outline',      NULL, 'outline',      'Outline description',     'TEXT', ARRAY[]::text[], 60),
  ('attr_rose_dome',    'ROSE', 'dome_height','Dome height',             'SELECT', ARRAY['Flat', 'Low', 'Medium', 'High'], 70),
  ('attr_rose_facets',  'ROSE', 'facet_count','Number of facets',        'NUMBER', ARRAY[]::text[], 80),
  ('attr_step_rows',    'STEP', 'step_rows',  'Rows of steps',           'NUMBER', ARRAY[]::text[], 70),
  ('attr_portrait_thk', 'PORTRAIT', 'thickness_mm', 'Thickness (mm)',    'NUMBER', ARRAY[]::text[], 70)
ON CONFLICT ("id") DO NOTHING;

-- Cut style from the free-text shape where it says so.
UPDATE "PolishedStone" SET "cutStyle" = CASE
    WHEN "shape" ILIKE '%old mine%' THEN 'OLD_MINE'
    WHEN "shape" ILIKE '%old euro%' THEN 'OLD_EUROPEAN'
    WHEN "shape" ILIKE '%rose%' THEN 'ROSE'
    WHEN "shape" ILIKE '%portrait%' THEN 'PORTRAIT'
    WHEN "shape" ILIKE '%step%' THEN 'STEP'
  END
WHERE "cutStyle" IS NULL AND "shape" IS NOT NULL;

-- Measurements "L x W x D" (x, ×, or *).
UPDATE "PolishedStone" SET
  "lengthMm" = (regexp_match("measurements", '^\s*([0-9]+(?:\.[0-9]+)?)\s*[x×*]\s*([0-9]+(?:\.[0-9]+)?)\s*[x×*]\s*([0-9]+(?:\.[0-9]+)?)'))[1]::numeric,
  "widthMm"  = (regexp_match("measurements", '^\s*([0-9]+(?:\.[0-9]+)?)\s*[x×*]\s*([0-9]+(?:\.[0-9]+)?)\s*[x×*]\s*([0-9]+(?:\.[0-9]+)?)'))[2]::numeric,
  "depthMm"  = (regexp_match("measurements", '^\s*([0-9]+(?:\.[0-9]+)?)\s*[x×*]\s*([0-9]+(?:\.[0-9]+)?)\s*[x×*]\s*([0-9]+(?:\.[0-9]+)?)'))[3]::numeric
WHERE "lengthMm" IS NULL
  AND "measurements" ~ '^\s*[0-9]+(\.[0-9]+)?\s*[x×*]\s*[0-9]+(\.[0-9]+)?\s*[x×*]\s*[0-9]+(\.[0-9]+)?';

-- GIA round style "min - max x depth": length = max, width = min.
UPDATE "PolishedStone" SET
  "widthMm"  = (regexp_match("measurements", '^\s*([0-9]+(?:\.[0-9]+)?)\s*-\s*([0-9]+(?:\.[0-9]+)?)\s*[x×*]\s*([0-9]+(?:\.[0-9]+)?)'))[1]::numeric,
  "lengthMm" = (regexp_match("measurements", '^\s*([0-9]+(?:\.[0-9]+)?)\s*-\s*([0-9]+(?:\.[0-9]+)?)\s*[x×*]\s*([0-9]+(?:\.[0-9]+)?)'))[2]::numeric,
  "depthMm"  = (regexp_match("measurements", '^\s*([0-9]+(?:\.[0-9]+)?)\s*-\s*([0-9]+(?:\.[0-9]+)?)\s*[x×*]\s*([0-9]+(?:\.[0-9]+)?)'))[3]::numeric
WHERE "lengthMm" IS NULL
  AND "measurements" ~ '^\s*[0-9]+(\.[0-9]+)?\s*-\s*[0-9]+(\.[0-9]+)?\s*[x×*]\s*[0-9]+(\.[0-9]+)?';
