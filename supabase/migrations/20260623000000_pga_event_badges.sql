CREATE TABLE public.pga_event_badges (
  tourn_id    text PRIMARY KEY,
  event_name  text NOT NULL,
  badge_line1 text NOT NULL,
  badge_line2 text NOT NULL
);

ALTER TABLE public.pga_event_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read badges"
  ON public.pga_event_badges FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can write badges"
  ON public.pga_event_badges FOR ALL
  USING (is_admin());

-- 2026 PGA Tour season — generated from Slash Golf /schedule API
-- Edit any row to update a badge without a code change.
INSERT INTO public.pga_event_badges (tourn_id, event_name, badge_line1, badge_line2) VALUES
('006', 'Sony Open in Hawaii',                                     'HI',   'SONY'),
('002', 'The American Express',                                    'AM',   'XPRS'),
('004', 'Farmers Insurance Open',                                  'FRM',  'OPEN'),
('003', 'WM Phoenix Open',                                         'WM',   'PHX'),
('005', 'AT&T Pebble Beach Pro-Am',                               'PB',   'AT&T'),
('007', 'The Genesis Invitational',                                'GEN',  'INV'),
('010', 'Cognizant Classic in The Palm Beaches',                   'CGN',  'CLASS'),
('009', 'Arnold Palmer Invitational presented by Mastercard',      'AP',   'INV'),
('483', 'Puerto Rico Open',                                        'PR',   'OPEN'),
('011', 'THE PLAYERS Championship',                                'THE',  'PLYR'),
('475', 'Valspar Championship',                                    'VAL',  'SPAR'),
('020', 'Texas Children''s Houston Open',                          'HOU',  'OPEN'),
('041', 'Valero Texas Open',                                       'TX',   'OPEN'),
('014', 'Masters Tournament',                                      'THE',  'MSTR'),
('012', 'RBC Heritage',                                            'RBC',  'HRTG'),
('018', 'Zurich Classic of New Orleans',                           'NO',   'ZRCH'),
('556', 'Cadillac Championship',                                   'CAD',  'CHMP'),
('480', 'Truist Championship',                                     'TRU',  'CHMP'),
('553', 'ONEflight Myrtle Beach Classic',                          'MB',   'CLASS'),
('033', 'PGA Championship',                                        'PGA',  'CHMP'),
('019', 'THE CJ CUP Byron Nelson',                                 'CJ',   'CUP'),
('021', 'Charles Schwab Challenge',                                'SCH',  'CHLG'),
('023', 'the Memorial Tournament presented by Workday',            'MEM',  'TOURN'),
('032', 'RBC Canadian Open',                                       'CA',   'OPEN'),
('026', 'U.S. Open',                                               'US',   'OPEN'),
('034', 'Travelers Championship',                                  'TRV',  'CHMP'),
('030', 'John Deere Classic',                                      'JD',   'CLASS'),
('541', 'Genesis Scottish Open',                                   'SCT',  'OPEN'),
('518', 'ISCO Championship',                                       'ISCO', 'CHMP'),
('100', 'The Open Championship',                                   'THE',  'OPEN'),
('522', 'Corales Puntacana Championship',                          'PTC',  'CHMP'),
('525', '3M Open',                                                 '3M',   'OPEN'),
('524', 'Rocket Classic',                                          'RKT',  'CLASS'),
('013', 'Wyndham Championship',                                    'WYN',  'CHMP'),
('027', 'FedEx St. Jude Championship',                             'FDX',  'JUDE'),
('028', 'BMW Championship',                                        'BMW',  'CHMP'),
('060', 'TOUR Championship',                                       'TOUR', 'CHMP'),
('557', 'Biltmore Championship Asheville',                         'BLT',  'CHMP'),
('500', 'Presidents Cup',                                          'PRES', 'CUP'),
('554', 'Bank of Utah Championship',                               'UTAH', 'CHMP'),
('527', 'Baycurrent Classic',                                      'BAY',  'CLASS'),
('528', 'Butterfield Bermuda Championship',                        'BDA',  'CHMP'),
('540', 'VidantaWorld Mexico Open',                                'MEX',  'OPEN'),
('457', 'World Wide Technology Championship',                      'WWT',  'CHMP'),
('558', 'Good Good Championship',                                  'GG',   'CHMP'),
('493', 'The RSM Classic',                                         'RSM',  'CLASS'),
('478', 'Hero World Challenge',                                    'HWC',  'HERO'),
('551', 'Grant Thornton Invitational',                             'GT',   'INV');
