// Monitored slope sites across the eight NE states.
// Coordinates are town/hill centres. `pop` is an approximate Census-2011-scale figure used ONLY to weight
// emergency prioritisation. Geology classes carry typical literature soil strengths (see README) and should be
// replaced by site-specific geotechnical data when GSI / state DMA data is available.

export const GEOLOGY = {
  laterite:        { label: 'Lateritic residual soil',         c: 8,  phi: 28, gamma: 18.0, z: 2.5, thetaSat: 0.46 },
  granite_gneiss:  { label: 'Weathered granite-gneiss',        c: 10, phi: 30, gamma: 18.5, z: 3.0, thetaSat: 0.42 },
  sandstone_shale: { label: 'Weathered sandstone-shale',       c: 12, phi: 27, gamma: 19.5, z: 3.5, thetaSat: 0.44 },
  phyllite:        { label: 'Weathered phyllite / schist',     c: 9,  phi: 26, gamma: 19.0, z: 3.0, thetaSat: 0.43 },
};

const S = (id, name, state, lat, lng, pop, geology) => ({ id, name, state, lat, lng, pop, geology });

export const SITES = [
  S('guwahati', 'Guwahati hills', 'Assam', 26.1445, 91.7362, 1100000, 'granite_gneiss'),
  S('diphu', 'Diphu', 'Assam', 25.84, 93.43, 64000, 'granite_gneiss'),
  S('haflong', 'Haflong', 'Assam', 25.1667, 93.0167, 12000, 'sandstone_shale'),
  S('shillong', 'Shillong', 'Meghalaya', 25.5788, 91.8933, 354000, 'granite_gneiss'),
  S('cherrapunji', 'Sohra (Cherrapunji)', 'Meghalaya', 25.27, 91.72, 10000, 'laterite'),
  S('jowai', 'Jowai', 'Meghalaya', 25.45, 92.2, 28000, 'granite_gneiss'),
  S('tura', 'Tura', 'Meghalaya', 25.514, 90.203, 74000, 'granite_gneiss'),
  S('aizawl', 'Aizawl', 'Mizoram', 23.7271, 92.7176, 293000, 'sandstone_shale'),
  S('lunglei', 'Lunglei', 'Mizoram', 22.888, 92.735, 57000, 'sandstone_shale'),
  S('champhai', 'Champhai', 'Mizoram', 23.4733, 93.3283, 32000, 'sandstone_shale'),
  S('kohima', 'Kohima', 'Nagaland', 25.6751, 94.1086, 100000, 'sandstone_shale'),
  S('mokokchung', 'Mokokchung', 'Nagaland', 26.322, 94.515, 35000, 'sandstone_shale'),
  S('tamenglong', 'Tamenglong', 'Manipur', 24.993, 93.486, 14000, 'sandstone_shale'),
  S('noney', 'Noney', 'Manipur', 24.974, 93.583, 5000, 'sandstone_shale'),
  S('churachandpur', 'Churachandpur', 'Manipur', 24.3333, 93.6833, 27000, 'sandstone_shale'),
  S('ukhrul', 'Ukhrul', 'Manipur', 25.1167, 94.3667, 30000, 'sandstone_shale'),
  S('gangtok', 'Gangtok', 'Sikkim', 27.3389, 88.6065, 100000, 'phyllite'),
  S('pelling', 'Pelling', 'Sikkim', 27.3, 88.24, 2500, 'phyllite'),
  S('lachung', 'Lachung', 'Sikkim', 27.69, 88.74, 2500, 'phyllite'),
  S('itanagar', 'Itanagar', 'Arunachal Pradesh', 27.0844, 93.6053, 59000, 'sandstone_shale'),
  S('ziro', 'Ziro', 'Arunachal Pradesh', 27.545, 93.83, 12000, 'phyllite'),
  S('bomdila', 'Bomdila', 'Arunachal Pradesh', 27.265, 92.415, 8000, 'phyllite'),
  S('tawang', 'Tawang', 'Arunachal Pradesh', 27.586, 91.8594, 11000, 'phyllite'),
  S('pasighat', 'Pasighat', 'Arunachal Pradesh', 28.0667, 95.3333, 24000, 'sandstone_shale'),
  S('jampui', 'Jampui Hills', 'Tripura', 24.23, 92.28, 3000, 'sandstone_shale'),
];

const P = (lat, lng) => ({ lat, lng });
// Corridors are approximate alignments between named waypoints (not surveyed centre-lines).
export const ROADS = [
  { id: 'gwh-shl-hfl', name: 'Guwahati - Shillong - Jowai - Haflong', pts: [P(26.1445, 91.7362), P(25.5788, 91.8933), P(25.45, 92.2), P(25.1667, 93.0167)] },
  { id: 'dmp-koh-imp', name: 'Dimapur - Kohima - Imphal', pts: [P(25.904, 93.7266), P(25.6751, 94.1086), P(25.5167, 94.1167), P(25.2667, 94.0167), P(24.817, 93.9368)] },
  { id: 'imp-noney-jir', name: 'Imphal - Noney - Jiribam', pts: [P(24.817, 93.9368), P(24.974, 93.583), P(24.804, 93.113)] },
  { id: 'tawang', name: 'Bhalukpong - Bomdila - Sela - Tawang', pts: [P(27.0167, 92.6), P(27.265, 92.415), P(27.36, 92.24), P(27.5, 92.09), P(27.586, 91.8594)] },
  { id: 'gtk-lachung', name: 'Gangtok - Mangan - Lachung', pts: [P(27.3389, 88.6065), P(27.51, 88.53), P(27.6, 88.64), P(27.69, 88.74)] },
  { id: 'slc-azl-lng', name: 'Silchar - Aizawl - Lunglei', pts: [P(24.8333, 92.7789), P(24.28, 92.67), P(23.7271, 92.7176), P(23.3, 92.85), P(22.888, 92.735)] },
  { id: 'itn-ziro', name: 'Itanagar - Ziro', pts: [P(27.0844, 93.6053), P(27.2, 93.7), P(27.545, 93.83)] },
];

export const STATES = ['Arunachal Pradesh', 'Assam', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Tripura'];
