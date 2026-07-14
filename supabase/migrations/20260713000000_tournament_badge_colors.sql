-- Tournament badge color system.
-- Source: Claude Design "Tournament Badges" prototype (prototype/Tournament Badges.dc.html).
--
-- badge_config changes shape: an array of styled text lines becomes one object —
--   { "line1": "THE", "line2": "OPEN", "bg": "#162258", "border": "#C9A368" }
--
-- Shape and type are fixed in the component; only copy + the two colors vary. Line 1
-- always renders cream, line 2 always renders in the border color, and the component
-- derives line 1's font size from its length. Color encodes prestige + geography:
-- each major gets a signature palette, tour events follow a regional system.
--
-- Naming logic: line 1 = sponsor initials / location code / iconic short name (<=4 chars);
-- line 2 = event type or city code (OPEN, CHP, INV, CLS, CUP, or a 3-letter city).

WITH badges(tourn_id, line1, line2, bg, border) AS (VALUES
  -- Majors — signature palettes
  ('014', 'THE',  'MSTR', '#004F2D', '#E8C872'),  -- Masters
  ('026', 'US',   'OPEN', '#1F6F47', '#E6C66B'),  -- U.S. Open
  ('100', 'THE',  'OPEN', '#162258', '#C9A368'),  -- The Open Championship
  ('033', 'PGA',  'CHP',  '#0A1628', '#B8C8DC'),  -- PGA Championship

  -- Flagship & playoffs — dark + prestige gold
  ('011', 'THE',  'PLRS', '#141414', '#C9A368'),  -- THE PLAYERS
  ('027', 'FDX',  'STJ',  '#2A0818', '#DC4848'),  -- FedEx St. Jude
  ('028', 'BMW',  'CHP',  '#0E1E30', '#6AAEE0'),  -- BMW Championship
  ('060', 'TOUR', 'CHP',  '#141414', '#E8C872'),  -- TOUR Championship

  -- Hawaii & West Coast — ocean / coastal
  ('006', 'SNY',  'HNL',  '#0B3D52', '#68C8C0'),  -- Sony Open in Hawaii
  ('002', 'AMX',  'PRO',  '#0B3D52', '#68C8C0'),  -- The American Express
  ('004', 'FMR',  'INS',  '#0B3D52', '#68C8C0'),  -- Farmers Insurance Open
  ('005', 'PBL',  'BCH',  '#0B3D52', '#68C8C0'),  -- AT&T Pebble Beach Pro-Am
  ('007', 'GEN',  'INV',  '#0B3D52', '#68C8C0'),  -- The Genesis Invitational

  -- Desert & Southwest
  ('003', 'WM',   'PHX',  '#281808', '#E07848'),  -- WM Phoenix Open
  ('041', 'VLR',  'TEX',  '#281808', '#E07848'),  -- Valero Texas Open
  ('020', 'HOU',  'OPN',  '#281808', '#E07848'),  -- Texas Children's Houston Open
  ('021', 'CSC',  'FTW',  '#281808', '#E07848'),  -- Charles Schwab Challenge
  ('540', 'MEX',  'OPN',  '#22300C', '#80C060'),  -- VidantaWorld Mexico Open

  -- Southeast & Florida
  ('010', 'COG',  'PBC',  '#1B4332', '#E6C66B'),  -- Cognizant Classic
  ('009', 'AP',   'INV',  '#1B4332', '#E6C66B'),  -- Arnold Palmer Invitational
  ('483', 'PR',   'OPEN', '#0C3C52', '#68C8C4'),  -- Puerto Rico Open
  ('475', 'VLS',  'CHP',  '#1B4332', '#E6C66B'),  -- Valspar Championship
  ('012', 'RBC',  'HRT',  '#1B4332', '#E6C66B'),  -- RBC Heritage
  ('480', 'TRT',  'CHP',  '#1B4332', '#E6C66B'),  -- Truist Championship
  ('553', 'MYR',  'BCH',  '#0C3C52', '#68C8C4'),  -- ONEflight Myrtle Beach Classic
  ('528', 'BDA',  'CHP',  '#0C3C52', '#68C8C4'),  -- Butterfield Bermuda Championship
  ('522', 'COR',  'PTC',  '#0C3C52', '#68C8C4'),  -- Corales Puntacana Championship
  ('493', 'RSM',  'CLS',  '#1B4332', '#E6C66B'),  -- The RSM Classic
  ('558', 'GG',   'CHP',  '#1B4332', '#E6C66B'),  -- Good Good Championship

  -- Midwest, North & other US
  ('019', 'CJ',   'CUP',  '#141414', '#C9A368'),  -- THE CJ CUP Byron Nelson
  ('023', 'MEM',  'TRN',  '#1B4332', '#E6C66B'),  -- the Memorial Tournament
  ('030', 'JD',   'CLS',  '#183808', '#E8D020'),  -- John Deere Classic
  ('525', '3M',   'OPN',  '#181818', '#E04040'),  -- 3M Open
  ('013', 'WYN',  'CHP',  '#1B4332', '#E6C66B'),  -- Wyndham Championship
  ('524', 'RKT',  'CLS',  '#181818', '#E04040'),  -- Rocket Classic
  ('018', 'ZUR',  'NOLA', '#241640', '#C0A0D8'),  -- Zurich Classic of New Orleans
  ('557', 'BLT',  'AVL',  '#241640', '#C0A0D8'),  -- Biltmore Championship Asheville
  ('034', 'TRV',  'CHP',  '#102840', '#6AB0DC'),  -- Travelers Championship
  ('554', 'BOU',  'CHP',  '#102840', '#6AB0DC'),  -- Bank of Utah Championship
  ('518', 'ISCO', 'CHP',  '#1B4332', '#E6C66B'),  -- ISCO Championship
  ('556', 'CDL',  'CHP',  '#1A1A1A', '#C8C4BA'),  -- Cadillac Championship

  -- International
  ('032', 'RBC',  'CAN',  '#780A0A', '#E8C870'),  -- RBC Canadian Open
  ('541', 'SCT',  'OPN',  '#14245C', '#70A8C8'),  -- Genesis Scottish Open
  ('527', 'BAY',  'CLS',  '#0A3044', '#68C4C4'),  -- Baycurrent Classic
  ('457', 'WWT',  'CHP',  '#0B3D52', '#68C8C0'),  -- World Wide Technology Championship

  -- Special events
  ('500', 'PRES', 'CUP',  '#0A1628', '#B8C8DC'),  -- Presidents Cup
  ('478', 'HRO',  'WLD',  '#141414', '#E8C872'),  -- Hero World Challenge
  ('551', 'GTI',  'INV',  '#1B4332', '#E6C66B')   -- Grant Thornton Invitational
)
UPDATE public.pga_event_badges b
SET badge_config = jsonb_build_object(
  'line1', x.line1,
  'line2', x.line2,
  'bg',    x.bg,
  'border', x.border
)
FROM badges x
WHERE b.tourn_id = x.tourn_id;

-- Pools copy badge_config onto the event at creation, so existing events still hold the
-- old array shape. Repoint them at the reseeded art so live pools pick up the colors too.
UPDATE golf.event_details d
SET badge_config = b.badge_config
FROM public.pga_event_badges b
WHERE d.slash_golf_tournament_id = b.tourn_id;
