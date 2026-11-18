(function (global) {
  function normalizeAlbanian(raw) {
    if (!raw) return '';
    return String(raw)
      .toUpperCase()
      .replace(/Ë/g, 'E')
      .replace(/Ç/g, 'C')
      .replace(/[^A-Z]/g, '');
  }

  function canFormWord(word, letters) {
    const target = normalizeAlbanian(word);
    if (target.length < 2) return false;
    const pool = {};
    for (const ch of letters) {
      const n = normalizeAlbanian(ch);
      if (n) pool[n] = (pool[n] || 0) + 1;
    }
    for (const ch of target) {
      if (!pool[ch]) return false;
      pool[ch] -= 1;
    }
    return true;
  }

  const TEAMS = [
    { id: 'tirana', tag: '#tirana', label: 'Tirana', flag: '🇦🇱', color: '#ff3b5c' },
    { id: 'prishtina', tag: '#prishtina', label: 'Prishtina', flag: '🇽🇰', color: '#3b82f6' },
    { id: 'shkodra', tag: '#shkodra', label: 'Shkodra', flag: '🇦🇱', color: '#f59e0b' },
    { id: 'vlora', tag: '#vlora', label: 'Vlora', flag: '🇦🇱', color: '#06b6d4' },
    { id: 'tetova', tag: '#tetova', label: 'Tetova', flag: '🇲🇰', color: '#10b981' },
    { id: 'zvicra', tag: '#zvicra', label: 'Diaspora CH', flag: '🇨🇭', color: '#ef4444' },
    { id: 'gjermania', tag: '#gjermania', label: 'Diaspora DE', flag: '🇩🇪', color: '#eab308' },
    { id: 'anglia', tag: '#anglia', label: 'Diaspora UK', flag: '🇬🇧', color: '#8b5cf6' },
    { id: 'italia', tag: '#italia', label: 'Diaspora IT', flag: '🇮🇹', color: '#22c55e' }
  ];

  const THEMES = [
    { id: 'theme-kuqezi', name: 'Kuq e Zi VIP', badge: '🇦🇱 Kuq e Zi' },
    { id: 'theme-ksamil', name: 'Ksamil Riviera', badge: '🌊 Ksamil Blu' },
    { id: 'theme-prishtina-neon', name: 'Prishtina Neon', badge: '⚡ Neon Violet' },
    { id: 'theme-valbona', name: 'Alpet e Valbonës', badge: '🌲 Emerald' },
    { id: 'theme-tirana-gold', name: 'Blloku Gold', badge: '👑 Gold Luxury' },
    { id: 'theme-matrix-shqip', name: 'Cyber Shqip', badge: '💚 Cyber Matrix' }
  ];

  const SONGS = [
    { id: 0, name: 'Valle Elektronike (Tallava Trap)', bpm: 128 },
    { id: 1, name: 'Tirana Drill & 808', bpm: 136 },
    { id: 2, name: 'Ksamil Sunset Lofi', bpm: 94 },
    { id: 3, name: 'Çifteli Synthwave', bpm: 134 },
    { id: 4, name: 'Shkodra Retro Arcade', bpm: 142 },
    { id: 5, name: 'Kuq e Zi Stadium Anthem', bpm: 124 }
  ];

  const ROUNDS = [
    {
      id: 1,
      category: 'Shqipëria & Kombi 🇦🇱',
      letters: ['S', 'H', 'Q', 'I', 'P', 'Ë', 'R', 'I', 'A'],
      words: [
        'SHI', 'ARI', 'ERA', 'HAPI', 'PARË', 'PASHË', 'PESHQ', 'SHQIP',
        'QEPA', 'SQEP', 'QIRI', 'PRES', 'QESH', 'SHQIPE', 'QERSHI', 'QERSHIA',
        'SHQIPËRIA'
      ],
      goldens: ['SHQIPËRIA', 'QERSHIA', 'SHQIPE', 'QERSHI'],
      bonus: [
        'ARË', 'QARË', 'QIRA', 'HIRI', 'PRISH', 'PRISHA', 'PIQ', 'QEP',
        'PËR', 'HAP', 'HERA', 'PISHË', 'PISHA', 'RASHË', 'QESHA', 'SQEPI',
        'SQEPAR', 'SHIRA', 'HIR', 'PAS'
      ]
    },
    {
      id: 2,
      category: 'Deti & Riviera (Ksamil) 🌊',
      letters: ['D', 'E', 'T', 'I', 'V', 'A', 'L', 'Ë', 'R'],
      words: [
        'DET', 'ARI', 'ART', 'ERË', 'VIT', 'DITA', 'VERA', 'VALË',
        'VELA', 'LART', 'VITE', 'TRE', 'DRITË', 'LETRA', 'VILA',
        'TËRË', 'VETË', 'VLERAT', 'LIDERË', 'DETARI'
      ],
      goldens: ['DETARI', 'DRITË', 'VLERAT', 'LETRA'],
      bonus: [
        'DETAR', 'DETI', 'DRITA', 'DITË', 'VERË', 'VLERA', 'VLERË', 'LETËR',
        'TELA', 'TELI', 'TAVË', 'DERË', 'DERA',
        'DELE', 'DELET', 'DATË', 'DIETA', 'LIDER', 'IDE', 'IDEAL', 'ELITË',
        'LIRA', 'LIRË', 'VATËR', 'TREVA', 'LARTË', 'TRI', 'ARË',
        'ARTË', 'ARTI', 'VILË', 'VILAT', 'VELAT', 'ATI', 'DITAR', 'DELTA',
        'TREVË'
      ]
    },
    {
      id: 3,
      category: 'Sofra & Ushqimi Shqiptar 🥧',
      letters: ['B', 'U', 'K', 'Ë', 'R', 'Y', 'E', 'T', 'A'],
      words: [
        'BUKË', 'URË', 'BUTË', 'URTË', 'TUBË', 'KRYE', 'BËRË', 'BYREK',
        'BUKA', 'KAT', 'KATËR', 'BAR', 'BARK', 'TRU', 'TRE', 'ERË',
        'ARË', 'KUR', 'BAKËR', 'KRYET', 'TYRE', 'TËRË', 'BYREKU'
      ],
      goldens: ['BYREKU', 'BYREK', 'BUKË', 'KATËR'],
      bonus: [
        'URA', 'URAT', 'TUBA', 'BËRA', 'KATE', 'BARKU', 'ERA',
        'ART', 'KURË', 'KURA', 'KURAT', 'TEK', 'KUB', 'KËTU', 'KËTË',
        'KËTA', 'ATË', 'ATY', 'TEKA'
      ]
    },
    {
      id: 4,
      category: 'Muzika & Festa 🎶',
      letters: ['K', 'Ë', 'N', 'G', 'A', 'V', 'L', 'L', 'E'],
      words: [
        'LEK', 'KALË', 'VLEN', 'KËNGË', 'KËNGA', 'VËLLA', 'VALLE',
        'LËNG', 'LALË', 'KANË', 'VELA', 'VALË', 'LEVË', 'LEGEN', 'NGEL',
        'NGA', 'LAG', 'VËNË', 'LËNË', 'VELË',
        'NGELA', 'LEKË'
      ],
      goldens: ['VALLE', 'KËNGË', 'KËNGA', 'VËLLA'],
      bonus: ['VEGËL', 'VEGLA', 'LAVË']
    },
    {
      id: 5,
      category: 'Familja & Zemra ❤️',
      letters: ['Z', 'E', 'M', 'Ë', 'R', 'N', 'A', 'T', 'D'],
      words: [
        'NATË', 'DERË', 'MEND', 'NDER', 'EMËR', 'ZEMËR', 'ZEMRA', 'EMRAT',
        'ZEMRAT', 'ARTË', 'DERA', 'NETË', 'ERË', 'ARMË', 'DËM', 'TËRË',
        'MËZ', 'MARTË', 'DRE', 'DET', 'ZËRA'
      ],
      goldens: ['ZEMRAT', 'ZEMRA', 'ZEMËR', 'EMRAT'],
      bonus: [
        'ZËRAT', 'DËMET', 'MËZA', 'MËZAT', 'ZAR', 'MEZE',
        'MEZET', 'MAT', 'NDARË', 'ARË', 'ART', 'ZËNË', 'ATË'
      ]
    },
    {
      id: 6,
      category: 'Qytetet & Trojet 🏙️',
      letters: ['T', 'I', 'R', 'A', 'N', 'A', 'K', 'O', 'V'],
      words: [
        'ORA', 'TOKA', 'NATA', 'ARKA', 'VOTA', 'KOT', 'ORTAK', 'TRIO',
        'AKTOR', 'KOVA', 'TON', 'NOTA', 'KINO', 'KROI', 'TANI', 'ATA',
        'ATO', 'ATI', 'ARI', 'ART', 'TRI', 'TANK', 'VATAN',
        'RAKI', 'AVOKAT', 'NOTAR', 'KONTRA', 'KARTON', 'AKTORI', 'NOTARI', 'TIRANA'
      ],
      goldens: ['TIRANA', 'KARTON', 'AVOKAT', 'NOTARI'],
      bonus: [
        'ARKAT', 'AVOKATI', 'KORITA', 'IKONA', 'IKONAT',
        'KORI', 'KOVAT', 'ARTI', 'VATANI', 'RAKIA', 'ATAK'
      ]
    },
    {
      id: 7,
      category: 'Natyra & Alpet Shqiptare 🏔️',
      letters: ['M', 'A', 'L', 'I', 'F', 'U', 'S', 'H', 'Ë'],
      words: [
        'MAL', 'SHI', 'MALI', 'LUMI', 'SHIU', 'FLAS', 'FUSHA', 'SHUMË',
        'LASHË', 'LUMË', 'FUSHË', 'MISH', 'FILM', 'MALE', 'LIS', 'HUA',
        'FASHË', 'MASË', 'SHUL', 'MALËSI', 'FIS', 'FISE', 'AFSH', 'MUA'
      ],
      goldens: ['MALËSI', 'FUSHË', 'FUSHA', 'SHUMË'],
      bonus: [
        'FILMA', 'LIMA', 'LIMË', 'HALI', 'SHUMA', 'MES', 'ISH', 'ISHA',
        'LESH', 'LUS', 'HAS', 'FLE', 'MIU'
      ]
    },
    {
      id: 8,
      category: 'Sporti & Kampionët ⚽',
      letters: ['F', 'I', 'T', 'O', 'R', 'E', 'G', 'L', 'A'],
      words: [
        'FAT', 'GOL', 'LIGA', 'GARË', 'GOLI', 'FORTË', 'GOLFI', 'FLOTA',
        'LART', 'TIFO', 'GOLF', 'ART', 'ARTI', 'LOT', 'LOTI', 'FLET',
        'FLORA', 'GATI', 'TREG', 'TRI', 'TRE',
        'TROFE', 'GOTA', 'FILTRA', 'GOLAT', 'FITORE'
      ],
      goldens: ['FITORE', 'FILTRA', 'FORTË', 'TROFE'],
      bonus: [
        'FLETA', 'LIGAT', 'FLE', 'FLI', 'GAFË',
        'GOTË', 'LETRA', 'LIRË', 'LIRA', 'ORA', 'ORË', 'LAG'
      ]
    },
    {
      id: 9,
      category: 'Diaspora & Mërgimi ✈️',
      letters: ['M', 'Ë', 'R', 'G', 'I', 'M', 'T', 'A', 'R'],
      words: [
        'RRI', 'TRIM', 'MAMI', 'MIRË', 'EMRI', 'TRIMA', 'MARRË', 'MËRGIM',
        'EMRA', 'GËRMA', 'ART', 'ARMË', 'MAT', 'MIT', 'GRAM', 'MIRA',
        'RITËM', 'GRIMË', 'MARTIR', 'TREMA', 'RIMA', 'RIMË', 'MARTË',
        'TREG', 'TRI', 'TRE', 'MARR', 'GËRMAT', 'GËRMIM', 'MARRIM',
        'RRIT', 'MËRGIMTAR'
      ],
      goldens: ['MËRGIMTAR', 'MËRGIM', 'MARTIR', 'GËRMIM'],
      bonus: ['ARTI', 'ARTË', 'RIMAT', 'GRIMA', 'EMRAT', 'MERITA']
    },
    {
      id: 10,
      category: 'Dashuria & Nata Romantike 💕',
      letters: ['D', 'A', 'S', 'H', 'U', 'R', 'I', 'J', 'Ë'],
      words: [
        'DUA', 'UJË', 'DRU', 'ERA', 'RUAJ', 'DUAJ', 'DASHI', 'SHUAJ',
        'DASHUR', 'DHE', 'DHEU', 'DUAR', 'AJËR', 'AJRI', 'HUAJ', 'DIJE',
        'DJE', 'RASHË', 'UJI', 'URË', 'URA', 'SHIU',
        'SHI', 'HIR', 'DASH', 'ARI', 'ARË', 'DASHURI'
      ],
      goldens: ['DASHURI', 'DASHUR', 'DASHI', 'SHUAJ'],
      bonus: [
        'DUSH', 'SHUAR', 'SAJ', 'ISHA', 'ISH', 'HUA',
        'DHI', 'DHIA', 'SHIJA'
      ]
    },
    {
      id: 11,
      category: 'Kafe & Biseda (Blloku) ☕',
      letters: ['K', 'A', 'F', 'E', 'B', 'I', 'S', 'D', 'Ë'],
      words: [
        'FIK', 'FIS', 'KAFE', 'BESA', 'SKEDË', 'BESË',
        'FISE', 'DISK', 'DISKE', 'SKEDA', 'KADIFE', 'IDE', 'SAFI',
        'BISEDA', 'SKI', 'BISEDË'
      ],
      goldens: ['BISEDË', 'BISEDA', 'KADIFE', 'SKEDË'],
      bonus: ['BIS', 'BIDE', 'FAKS', 'FAKSI']
    },
    {
      id: 12,
      category: 'Pazari i Vjetër & Çarshia 🏮',
      letters: ['Ç', 'A', 'R', 'S', 'H', 'I', 'P', 'Ë', 'T'],
      words: [
        'HAP', 'ÇATI', 'SHIT', 'PRIT', 'SHPIRT', 'SHTËPI', 'TRASHË', 'ÇARË',
        'ÇIP', 'ÇEP', 'ÇEPI', 'PRISH', 'PISHË', 'HAPI', 'PARË', 'PASHË',
        'ART', 'ARTË', 'PRITA', 'ARË', 'ÇARSHI', 'ÇAST', 'ÇASTI', 'ÇETA',
        'TASH', 'TEH', 'TRE', 'TRI', 'PRA', 'PËR', 'PAS', 'HIÇ'
      ],
      goldens: ['SHPIRT', 'ÇARSHI', 'SHTËPI', 'TRASHË'],
      bonus: ['SHI', 'SITË', 'SITA', 'PSE', 'ATË', 'ATI', 'ARI']
    },
    {
      id: 13,
      category: 'Shkolla & Libri 📚',
      letters: ['L', 'I', 'B', 'Ë', 'R', 'S', 'H', 'K', 'A'],
      words: [
        'LIBËR', 'LIBRA', 'KLASË', 'KISHË', 'KISHA', 'SHKEL', 'SHKELA',
        'BËRA', 'LIS', 'LESH', 'LEK', 'LARË', 'BARK',
        'BAKËR', 'BAKRI', 'KALË', 'KALI', 'KRAH', 'KRAHË', 'HARK', 'ARKË',
        'HIR', 'ISH', 'ISHA', 'RASHË', 'SHI', 'SHIRA', 'LIRA', 'LIRË',
        'BAR', 'BARI', 'LËR', 'LËRI'
      ],
      goldens: ['LIBËR', 'LIBRA', 'KLASË', 'LIRË'],
      bonus: []
    },
    {
      id: 14,
      category: 'Bujqësia & Kopshti 🌱',
      letters: ['T', 'R', 'A', 'K', 'O', 'L', 'P', 'Ë', 'S'],
      words: [
        'TOKA', 'LOPA', 'LOPË', 'PELA', 'KOSA', 'KOSË', 'KOSAT',
        'ARË', 'PËR', 'PRA', 'KALË', 'PRES', 'PREK', 'PREKA', 'PORT',
        'PORTA', 'KARTË', 'KAROTË', 'KOT', 'KOS', 'KRAP', 'LAK', 'LAKËR',
        'LARË', 'LEK', 'LOT', 'ORA', 'ORË', 'ORËT',
        'PAK', 'PALË', 'PARË', 'PARK', 'PAS', 'POR', 'KAPË', 'SOT',
        'SPORT', 'SPORTE', 'STOK', 'STOP', 'TAPË', 'TEK', 'TOP', 'TOPA', 'TRE'
      ],
      goldens: ['KAROTË', 'LAKËR', 'PORTA', 'KOSAT'],
      bonus: []
    },
    {
      id: 15,
      category: 'Udhëtimi & Transporti ✈️',
      letters: ['A', 'V', 'I', 'O', 'N', 'T', 'R', 'E', 'S'],
      words: [
        'AVION', 'TREN', 'TRENI', 'VIT', 'VITE', 'VERA', 'VOTA', 'NOTA',
        'NOTARI', 'NIS', 'NISA', 'SOT', 'TANI', 'TON', 'TONI', 'TRI',
        'TRIO', 'TRON', 'TRONI', 'TRE', 'ORA', 'OSE', 'ARI', 'ART',
        'ARTI', 'ATI', 'ATO', 'SITA', 'RAST', 'RASTI'
      ],
      goldens: ['AVION', 'TREN', 'TRENI', 'NOTARI'],
      bonus: []
    },
    {
      id: 16,
      category: 'Puna & Zanati 🛠️',
      letters: ['A', 'K', 'N', 'O', 'P', 'R', 'T', 'U', 'Ë'],
      words: [
        'PUNË', 'PUNA', 'PUNËTOR', 'PËR', 'POR', 'PORTA', 'PORT', 'PARK',
        'PARKU', 'PAK', 'PANË', 'PARË', 'PRA', 'PREK', 'PREKA',
        'PRET', 'TAPË', 'TEK', 'TOKA', 'TOP', 'TOPA', 'TRE',
        'TREN', 'TRON', 'TURP', 'KUR', 'KURA', 'KURAT', 'KURË', 'KAT',
        'KATE', 'KATËR', 'KARTË', 'KAROTË', 'KANË', 'KAP', 'KOT', 'KRAP',
        'NATË', 'NUK', 'TON', 'URA', 'URË', 'URAT', 'URTË', 'KAPË',
        'ART', 'ARTË', 'ARË', 'ATË', 'ATO', 'ANË', 'ANËT', 'AUTO', 'AUTOR'
      ],
      goldens: ['PUNËTOR', 'PUNË', 'AUTOR', 'PORTA'],
      bonus: []
    },
    {
      id: 17,
      category: 'Lojërat & Argëtimi 🎲',
      letters: ['L', 'O', 'J', 'Ë', 'R', 'A', 'T', 'I', 'M'],
      words: [
        'LOJË', 'LOJA', 'LOJËRA', 'LOJËRAT', 'LOJTAR', 'LOJTARI', 'LOJTARE',
        'MARTË', 'MIRA', 'MIRË', 'ROL', 'ROLI',
        'MIT', 'MOT', 'MOTI', 'MOTRA', 'MOTËR',
        'LOT', 'LOTI', 'LARË', 'LART', 'LARTË', 'LIRA', 'LIRË',
        'LETRA', 'RIMA', 'RIMË', 'RIMAT', 'RITËM', 'ROJA', 'ROJË', 'ROJAT',
        'TEMA', 'TREMA', 'TRI', 'TRIO', 'TRIM', 'TRIMA',
        'METRO', 'METRA', 'METRI', 'MAT', 'TRE', 'ORA', 'ORË', 'ORËT',
        'AJËR', 'AJRI', 'JETA', 'ARI', 'ART', 'ARTI', 'ARË', 'ATË', 'ATI',
        'ATO', 'MOJ'
      ],
      goldens: ['LOJTARI', 'LOJTAR', 'LOJËRA', 'LOJË'],
      bonus: []
    },
    {
      id: 18,
      category: 'Shtëpia & Banesa 🏠',
      letters: ['S', 'H', 'T', 'Ë', 'P', 'I', 'A', 'D', 'R'],
      words: [
        'SHTËPI', 'SHTËPIA', 'SHPIRT', 'SHPAT', 'STREHA',
        'TAPË', 'TESHA', 'HARTË', 'HERA', 'DERA',
        'DITA', 'DITË', 'DET', 'DETI', 'DHE', 'HAP', 'HAPI', 'HIR', 'HAS',
        'HASI', 'PËR', 'PARË', 'PAS', 'PASHË', 'PATË', 'PISHA', 'PISHË',
        'PRA', 'PRES', 'PRET', 'PRITA', 'PRISH', 'PRISHA', 'RASHË', 'SHI',
        'SHIRA', 'SHIT', 'SITA', 'TEH', 'TRE', 'TRI', 'DRE'
      ],
      goldens: ['SHTËPIA', 'SHTËPI', 'STREHA', 'TESHA'],
      bonus: []
    },
    {
      id: 19,
      category: 'Rrobat & Moda 👗',
      letters: ['R', 'R', 'O', 'B', 'A', 'T', 'Ë', 'S', 'H'],
      words: [
        'RROBA', 'RROBAT', 'RROBË', 'RROTA',
        'RROTË', 'RRETH', 'RRAH', 'RAST', 'ROSA', 'ROSË', 'ROSAT',
        'HERA', 'HARTË', 'HAS', 'BART', 'BESA', 'BESAT',
        'BËRA', 'BOTA', 'BOTË', 'BORA', 'BORË', 'BOSH',
        'BROSHË', 'BROSHA', 'TERR', 'TESHA', 'TRE'
      ],
      goldens: ['RROBAT', 'BROSHË', 'RROBA', 'TESHA'],
      bonus: []
    },
    {
      id: 20,
      category: 'Kafshët & Fshati 🐄',
      letters: ['K', 'A', 'F', 'S', 'H', 'Ë', 'T', 'I', 'R'],
      words: [
        'KAFSHË', 'KAFSHËT', 'FSHAT', 'FSHATI', 'FIK', 'FIS', 'FISE', 'FISET',
        'FAT', 'FATI', 'FARË', 'FASHË', 'FAKS', 'FAKSI', 'FRIKA',
        'HARK', 'HARTË', 'HAS', 'HASI', 'HAK', 'HIR', 'HIT',
        'HEKTAR', 'KAFE', 'KARTË', 'KAT', 'KATE', 'KATËR', 'KATI', 'KISHA',
        'KISHË', 'KITARË', 'KRAH', 'KRAHË', 'KRIS', 'RAKI',
        'RASHË', 'SHEF', 'SHEFI', 'SHI', 'SHIRA', 'SHIT', 'SITA', 'TEH',
        'TEK', 'TRE', 'TRI'
      ],
      goldens: ['KAFSHËT', 'KAFSHË', 'FSHATI', 'FSHAT'],
      bonus: []
    },
    {
      id: 21,
      category: 'Kinema & Filmat 🎬',
      letters: ['F', 'I', 'L', 'M', 'A', 'S', 'H', 'Ë', 'T'],
      words: [
        'FILM', 'FILMA', 'FILMAT', 'FLAS', 'FLET', 'FLETA', 'FLE',
        'FLI', 'FAT', 'FATI', 'FAL', 'FALS', 'FIS', 'FISE', 'FISET', 'HELM',
        'HIT', 'HAS', 'HASI', 'LEH', 'LESH', 'LIMA', 'LIMË', 'LIS',
        'MAL', 'MALI', 'MALE', 'MASË', 'MAT', 'MISH', 'MIT', 'SHEF', 'SHEFI',
        'SHI', 'SHIT', 'SITA', 'STIL', 'TEMA', 'TEH'
      ],
      goldens: ['FILMAT', 'FILMA', 'STIL', 'TEMA'],
      bonus: []
    },
    {
      id: 22,
      category: 'Festat & Traditat 🎉',
      letters: ['F', 'E', 'S', 'T', 'I', 'V', 'A', 'L', 'Ë'],
      words: [
        'FESTIVAL', 'FESTË', 'FESTA', 'FAT', 'FATI', 'FAL', 'FALS', 'FIS',
        'FISE', 'FISET', 'FLE', 'FLET', 'FLETA', 'FLETË', 'FLI', 'FLAS',
        'LIS', 'SITA', 'SITË', 'STIL', 'TAVË', 'VALË', 'VELA', 'VELË',
        'VELAT', 'VESË', 'VESA', 'VETË', 'VILA', 'VILË', 'VILAT', 'VIT',
        'VITE', 'FETA', 'FETË'
      ],
      goldens: ['FESTIVAL', 'FESTË', 'FESTA', 'FLETË'],
      bonus: []
    },
    {
      id: 23,
      category: 'Lulet & Bimët 🌸',
      letters: ['L', 'U', 'L', 'E', 'T', 'Ë', 'R', 'I', 'A'],
      words: [
        'LULE', 'LULET', 'TULLË', 'TELA', 'TELI',
        'TEL', 'TËRË', 'TRU', 'URA', 'URË', 'URAT', 'URTË', 'LARË', 'LART',
        'LARTË', 'LETËR', 'LETRA', 'LIRA', 'LIRË', 'ARI', 'ART', 'ARTI',
        'ARTË', 'ARË', 'ATË', 'ATI', 'TRE', 'TRI', 'LULETAR', 'LULETARI',
        'LËR', 'LËRI'
      ],
      goldens: ['LULET', 'LULE', 'LULETAR', 'LETËR'],
      bonus: []
    },
    {
      id: 24,
      category: 'Bora & Dimri ❄️',
      letters: ['D', 'Ë', 'B', 'O', 'R', 'Ë', 'S', 'H', 'I'],
      words: [
        'DËBORË', 'DËSHIRË', 'BORË', 'SHI', 'ERË', 'ORË', 'DORË',
        'ROSË', 'ISH', 'HIR',
        'BOSH', 'HERË', 'DHE', 'DHI',
        'BISHË', 'BREDH', 'BREDHI', 'DORËS', 'BORËS', 'SHËRO'
      ],
      goldens: ['DËBORË', 'DËSHIRË', 'BORË', 'DORË'],
      bonus: []
    }
  ];

  const VIEWERS_POOL = [
    { user: 'andi_tirana', team: 'tirana' },
    { user: 'klea_ks', team: 'prishtina' },
    { user: 'genti_shkoder', team: 'shkodra' },
    { user: 'erion_vlora', team: 'vlora' },
    { user: 'besa_tetova', team: 'tetova' },
    { user: 'drilon_ch', team: 'zvicra' },
    { user: 'arjeta_de', team: 'gjermania' },
    { user: 'loren_uk', team: 'anglia' },
    { user: 'matteo_al', team: 'italia' },
    { user: 'fjoralba.01', team: 'tirana' },
    { user: 'bledi_vip', team: 'tirana' },
    { user: 'elona_pr', team: 'prishtina' },
    { user: 'granit_zh', team: 'zvicra' },
    { user: 'alban_bllok', team: 'tirana' },
    { user: 'sarah_shkodra', team: 'shkodra' },
    { user: 'visar_ks01', team: 'prishtina' },
    { user: 'drita_munich', team: 'gjermania' },
    { user: 'klajdi_vl', team: 'vlora' },
    { user: 'renis_london', team: 'anglia' },
    { user: 'dea_tirana', team: 'tirana' },
    { user: 'ermal_tetova', team: 'tetova' },
    { user: 'enkelejda_it', team: 'italia' },
    { user: 'flori_durres', team: 'tirana' },
    { user: 'donika_pr', team: 'prishtina' },
    { user: 'rigers_007', team: 'vlora' },
    { user: 'valon_basel', team: 'zvicra' },
    { user: 'megi_korca', team: 'tirana' },
    { user: 'ardit_shkoder', team: 'shkodra' },
    { user: 'shqiponja_kuq', team: 'prishtina' },
    { user: 'leart_berlini', team: 'gjermania' },
    { user: 'anisa_milano', team: 'italia' },
    { user: 'kris_manchester', team: 'anglia' },
    { user: 'altin_gjirokaster', team: 'vlora' },
    { user: 'jeta_gjakova', team: 'prishtina' },
    { user: 'ilir_zurich', team: 'zvicra' },
    { user: 'noel_tirana', team: 'tirana' },
    { user: 'xhesika_al', team: 'vlora' },
    { user: 'rinor_ferizaj', team: 'prishtina' },
    { user: 'teuta_tetov', team: 'tetova' },
    { user: 'ermal_kukes', team: 'shkodra' },
    { user: 'kevin_hamburg', team: 'gjermania' },
    { user: 'elisa_roma', team: 'italia' },
    { user: 'julian_londra', team: 'anglia' },
    { user: 'sara_elbasan', team: 'tirana' },
    { user: 'luan_peja', team: 'prishtina' },
    { user: 'era_saranda', team: 'vlora' },
    { user: 'bujar_luzern', team: 'zvicra' },
    { user: 'ornela_shk', team: 'shkodra' },
    { user: 'fatmir_shkup', team: 'tetova' },
    { user: 'edon_frankfurt', team: 'gjermania' },
    { user: 'kristina_torino', team: 'italia' },
    { user: 'beni_birmingham', team: 'anglia' },
    { user: 'kreshnik_tirana', team: 'tirana' },
    { user: 'valmira_prizren', team: 'prishtina' },
    { user: 'denis_berat', team: 'vlora' },
    { user: 'merita_geneve', team: 'zvicra' },
    { user: 'armend_tetova', team: 'tetova' },
    { user: 'albin_stuttgart', team: 'gjermania' },
    { user: 'rebecca_al', team: 'tirana' },
    { user: 'gentian_lezh', team: 'shkodra' }
  ];

  // Gift menu: one entry per interaction, with aliases so raw TikTok gift
  // names forwarded by a bridge are mapped automatically (server + client).
  const GIFTS = [
    {
      id: 'hint',
      emoji: '🚀',
      name: 'Rocket · Raketë',
      effect: 'Zbulo 2 shkronja',
      points: 100,
      coins: 5,
      aliases: ['rocket', 'raket', 'rakete', 'raketë', 'hint', 'lightning', 'rrufe']
    },
    {
      id: 'theme',
      emoji: '🌹',
      name: 'Rose · Trëndafil',
      effect: 'Ndryshon ngjyrat e lojës',
      points: 30,
      coins: 1,
      aliases: ['rose', 'roze', 'trendafil', 'trëndafil', 'ngjyr', 'color', 'background']
    },
    {
      id: 'song',
      emoji: '🎵',
      name: 'TikTok',
      effect: 'Ndryshon këngën e lojës',
      points: 50,
      coins: 1,
      aliases: ['tiktok', 'music', 'song', 'keng', 'kenge']
    },
    {
      id: 'eagle',
      emoji: '🫰',
      name: 'Finger Heart · Zemër me gishta',
      effect: '3X pikë VIP 45s + 1 fjalë',
      points: 200,
      coins: 5,
      aliases: ['finger heart', 'finger', 'heart', 'zemer', 'zemër', 'gisht', 'eagle', 'lion', 'galaxy', 'universe', 'castle', 'crown', 'shqiponj', 'vip']
    }
  ];

  const TIPS = [
    ['💬', 'SHKRUAJ FJALËN NË KOMENT'],
    ['👑', 'GJEJ FJALËN E ARTË · 3X PK'],
    ['❤️', '200+ LIKES = ZBULON 1 SHKRONJË'],
    ['🎁', 'DHURATA = HINT & 3X VIP'],
    ['⚡', 'FJALË BONUS = +25 PK'],
    ['🏆', 'TOP 3 FITOJNË ÇDO RAUND']
  ];

  global.ALBANIAN_DATA = {
    normalizeAlbanian,
    canFormWord,
    TEAMS,
    THEMES,
    SONGS,
    ROUNDS,
    VIEWERS_POOL,
    GIFTS,
    TIPS
  };
})(typeof window !== 'undefined' ? window : globalThis);
