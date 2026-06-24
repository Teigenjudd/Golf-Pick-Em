-- Replace badge_line1 / badge_line2 with a jsonb config array.
-- Each element: { "text": "US", "size": 16, "weight": 800, "color": "cream" }
-- Colors: "cream" | "gold" | "fairway" | "charcoal" | "#rrggbb"
-- Sizes and weights are absolute — tune per badge as needed.

ALTER TABLE public.pga_event_badges ADD COLUMN badge_config jsonb;

UPDATE public.pga_event_badges
SET badge_config = jsonb_build_array(
  jsonb_build_object('text', badge_line1, 'size', 16, 'weight', 800, 'color', 'cream'),
  jsonb_build_object('text', badge_line2, 'size', 7,  'weight', 700, 'color', 'gold')
);

ALTER TABLE public.pga_event_badges ALTER COLUMN badge_config SET NOT NULL;
ALTER TABLE public.pga_event_badges DROP COLUMN badge_line1;
ALTER TABLE public.pga_event_badges DROP COLUMN badge_line2;
