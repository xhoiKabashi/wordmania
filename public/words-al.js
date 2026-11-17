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
      words: ['ARI', 'ERA', 'QEPA', 'HAPI', 'PARË', 'PASHË', 'PESHQ', 'SHQIP', 'SHQIPËRIA'],
      golden: 'SHQIPËRIA',
      bomb: 'PESHQ',
      bonus: [
        'SHQIPËRI', 'ARË', 'QARË', 'SHARË', 'QIRA', 'HIRI', 'PRISH', 'PRISHA',
        'PESHQI', 'PIQ', 'QEP', 'PËR', 'HAP', 'SHERI', 'SHER', 'HERA',
        'PISHË', 'PISHA', 'SHIRA'
      ]
    },
    {
      id: 2,
      category: 'Deti & Riviera (Ksamil) 🌊',
      letters: ['D', 'E', 'T', 'I', 'V', 'A', 'L', 'Ë', 'R'],
      words: ['DET', 'VALË', 'DITA', 'VERA', 'LART', 'DRITË', 'VLERA', 'TREVA', 'VATËR'],
      golden: 'VLERA',
      bomb: 'DRITË',
      bonus: [
        'DETI', 'ERË', 'ERA', 'DALË', 'DITË', 'DERI', 'LIRË', 'LIRA',
        'VELA', 'VETË', 'VERË', 'RETË', 'AVLI', 'LETRA', 'DRITA', 'TELA', 'LËRË'
      ]
    },
    {
      id: 3,
      category: 'Sofra & Ushqimi Shqiptar 🥧',
      letters: ['B', 'U', 'K', 'Ë', 'R', 'Y', 'E', 'T', 'A'],
      words: ['URË', 'BUKË', 'BUTË', 'URTË', 'TUBË', 'KRYE', 'BËRË', 'BYREK', 'BYREKU'],
      golden: 'BYREKU',
      bomb: 'KRYE',
      bonus: [
        'BUKA', 'BUTA', 'URTA', 'KRYET', 'KREU', 'BREU', 'BËRA', 'TËRË',
        'BARË', 'BART', 'TYRE', 'ARË', 'ERË', 'KUB', 'KUBË', 'KURË',
        'KURA', 'KATE', 'URËT'
      ]
    },
    {
      id: 4,
      category: 'Muzika & Festa 🎶',
      letters: ['K', 'Ë', 'N', 'G', 'A', 'V', 'L', 'L', 'E'],
      words: ['LEK', 'LËNG', 'KALË', 'KALL', 'VLEN', 'KËNGË', 'KËNGA', 'VËLLA', 'VALLE'],
      golden: 'VALLE',
      bomb: 'KËNGË',
      bonus: [
        'VËNË', 'LËNË', 'LAG', 'LAGË', 'LEN', 'NGA', 'VALË', 'LEKA',
        'KALLË', 'GEN'
      ]
    },
    {
      id: 5,
      category: 'Familja & Zemra ❤️',
      letters: ['Z', 'E', 'M', 'Ë', 'R', 'N', 'A', 'T', 'D'],
      words: ['NATË', 'DERË', 'MEND', 'NDER', 'EMËR', 'ZEMËR', 'ZEMRA', 'EMRAT', 'ZEMRAT'],
      golden: 'ZEMRAT',
      bomb: 'NDER',
      bonus: [
        'ARTË', 'ZËRA', 'EMRA', 'DERA', 'NETË', 'ERË', 'ARMË', 'DËM',
        'DREN', 'NDARË', 'TËRË', 'NDERA', 'MENDË'
      ]
    },
    {
      id: 6,
      category: 'Qytetet & Trojet 🏙️',
      letters: ['T', 'I', 'R', 'A', 'N', 'A', 'K', 'O', 'V'],
      words: ['ORA', 'KOT', 'TOKA', 'VOTA', 'NATA', 'VORA', 'VAKT', 'ORTAK', 'TIRANA'],
      golden: 'TIRANA',
      bomb: 'ORTAK',
      bonus: [
        'ARKA', 'TONA', 'AKTOR', 'TRIO', 'VAKTI', 'KARTON', 'KORITA',
        'TIRAN', 'TOK', 'KOTA', 'KOVA', 'TANK', 'KROAT'
      ]
    },
    {
      id: 7,
      category: 'Natyra & Alpet Shqiptare 🏔️',
      letters: ['M', 'A', 'L', 'I', 'F', 'U', 'S', 'H', 'Ë'],
      words: ['MAL', 'SHI', 'MALI', 'LUMI', 'SHIU', 'FLAS', 'FUSHA', 'SHUMË', 'LASHË'],
      golden: 'SHUMË',
      bomb: 'FUSHA',
      bonus: [
        'LUM', 'LUMË', 'FUSHË', 'MISH', 'SHUMA', 'FILM', 'FILMA', 'AFSH',
        'HALI', 'HALË', 'SHUL', 'MASË', 'FASHË', 'MUA', 'HUA',
        'MIU', 'LIMA', 'LIMË'
      ]
    },
    {
      id: 8,
      category: 'Sporti & Kampionët ⚽',
      letters: ['F', 'I', 'T', 'O', 'R', 'E', 'G', 'L', 'A'],
      words: ['FAT', 'GOL', 'LIGA', 'GARË', 'GOLI', 'FORTË', 'GOLFI', 'GLORIA', 'FITORE'],
      golden: 'FITORE',
      bomb: 'FORTË',
      bonus: [
        'FATI', 'LART', 'TIFO', 'FORT', 'FORTA', 'ORA', 'ORË',
        'LIRË', 'LIRA', 'ROTA', 'TRIO', 'GOLF', 'ART', 'ARTI', 'FLET',
        'FLETA', 'LOT', 'LOTI', 'GRA', 'FLORA'
      ]
    },
    {
      id: 9,
      category: 'Diaspora & Mërgimi ✈️',
      letters: ['M', 'Ë', 'R', 'G', 'I', 'M', 'T', 'A', 'R'],
      words: ['RRI', 'TRIM', 'MAMI', 'MIRË', 'EMRI', 'TRIMA', 'MARRË', 'MËRGIM', 'MËRGIMTAR'],
      golden: 'MËRGIMTAR',
      bomb: 'MËRGIM',
      bonus: [
        'EMRA', 'RITËM', 'MARR', 'GËRMA', 'ART', 'ARTË', 'ARMË', 'MAT',
        'MIT', 'GRAM', 'RRIMA', 'RRIMË', 'TIM', 'MIRA', 'MITË'
      ]
    },
    {
      id: 10,
      category: 'Dashuria & Nata Romantike 💕',
      letters: ['D', 'A', 'S', 'H', 'U', 'R', 'I', 'J', 'Ë'],
      words: ['DUA', 'UJË', 'DRU', 'ERA', 'RUAJ', 'DUAJ', 'DASHI', 'SHUAJ', 'DASHURI'],
      golden: 'DASHURI',
      bomb: 'RUAJ',
      bonus: [
        'UJI', 'URË', 'URA', 'SHIU', 'SHI', 'HIR', 'ARDHI', 'SHARË',
        'SHIRA', 'DASH', 'ARI', 'ARË', 'JESH', 'DRUJA'
      ]
    },
    {
      id: 11,
      category: 'Kafe & Biseda (Blloku) ☕',
      letters: ['K', 'A', 'F', 'E', 'B', 'I', 'S', 'D', 'Ë'],
      words: ['FIK', 'FIS', 'KAFE', 'BESA', 'SADE', 'SEFA', 'BIFE', 'SKEDË', 'BISEDË'],
      golden: 'BISEDË',
      bomb: 'BESA',
      bonus: [
        'BESË', 'FIKA', 'FIKE', 'FISE', 'DISK', 'DISKE', 'KADE', 'BIK',
        'BIKA', 'FESA', 'FASE', 'DESI'
      ]
    },
    {
      id: 12,
      category: 'Pazari i Vjetër & Çarshia 🏮',
      letters: ['Ç', 'A', 'R', 'S', 'H', 'I', 'P', 'Ë', 'T'],
      words: ['HAP', 'ÇAP', 'ÇATI', 'SHIT', 'PRIT', 'TRASH', 'SHPIRT', 'SHTËPI', 'TRASHË'],
      golden: 'SHPIRT',
      bomb: 'SHTËPI',
      bonus: [
        'ÇAR', 'ÇARË', 'ÇAPI', 'ÇIP', 'ÇEP', 'ÇEPI', 'SHPI', 'PRISH',
        'PISHË', 'HAPI', 'PARË', 'PASHË', 'SHARË', 'SHITË', 'ART', 'ARTË',
        'PRITA', 'ARË'
      ]
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

  global.ALBANIAN_DATA = {
    normalizeAlbanian,
    canFormWord,
    TEAMS,
    THEMES,
    SONGS,
    ROUNDS,
    VIEWERS_POOL
  };
})(typeof window !== 'undefined' ? window : globalThis);
