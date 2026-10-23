import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Monitored slope sites across India's landslide-prone regions: the Himalaya (J&K, Ladakh, Himachal, Uttarakhand, Sikkim,
// Darjeeling), the North-East hills, the Western Ghats (Maharashtra, Karnataka, Kerala, Tamil Nadu) and the Eastern Ghats.
// Coordinates are town/hill centres. `pop` is an approximate Census-2011-scale figure used ONLY to weight
// emergency prioritisation. Geology classes carry typical literature soil strengths (see README) and should be
// replaced by site-specific geotechnical data when GSI / state DMA data is available.

export const GEOLOGY = {
  laterite:        { label: 'Lateritic residual soil',         c: 8,  phi: 28, gamma: 18.0, z: 2.5, thetaSat: 0.46 },
  granite_gneiss:  { label: 'Weathered granite-gneiss',        c: 10, phi: 30, gamma: 18.5, z: 3.0, thetaSat: 0.42 },
  sandstone_shale: { label: 'Weathered sandstone-shale',       c: 12, phi: 27, gamma: 19.5, z: 3.5, thetaSat: 0.44 },
  phyllite:        { label: 'Weathered phyllite / schist',     c: 9,  phi: 26, gamma: 19.0, z: 3.0, thetaSat: 0.43 },
  basalt:          { label: 'Weathered basalt (Deccan trap)',  c: 11, phi: 29, gamma: 19.0, z: 3.0, thetaSat: 0.45 },
  colluvium:       { label: 'Colluvium / glacial debris',      c: 5,  phi: 32, gamma: 19.5, z: 4.0, thetaSat: 0.38 },
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

  // ---- West Bengal (Darjeeling Himalaya) ----
  S('darjeeling', 'Darjeeling', 'West Bengal', 27.041, 88.2663, 120000, 'phyllite'),
  S('kalimpong', 'Kalimpong', 'West Bengal', 27.0594, 88.4695, 50000, 'phyllite'),
  S('kurseong', 'Kurseong', 'West Bengal', 26.8814, 88.2776, 40000, 'phyllite'),
  // ---- Himachal Pradesh ----
  S('shimla', 'Shimla', 'Himachal Pradesh', 31.1048, 77.1734, 170000, 'sandstone_shale'),
  S('mandi', 'Mandi', 'Himachal Pradesh', 31.708, 76.9318, 27000, 'sandstone_shale'),
  S('kullu', 'Kullu', 'Himachal Pradesh', 31.9579, 77.1095, 18000, 'colluvium'),
  S('manali', 'Manali', 'Himachal Pradesh', 32.2396, 77.1887, 8000, 'colluvium'),
  S('dharamshala', 'Dharamshala', 'Himachal Pradesh', 32.219, 76.3234, 53000, 'sandstone_shale'),
  S('chamba', 'Chamba', 'Himachal Pradesh', 32.5534, 76.1258, 20000, 'phyllite'),
  S('kinnaur', 'Kinnaur (Reckong Peo)', 'Himachal Pradesh', 31.5379, 78.2741, 2000, 'granite_gneiss'),
  // ---- Uttarakhand ----
  S('mussoorie', 'Mussoorie', 'Uttarakhand', 30.4598, 78.0664, 30000, 'sandstone_shale'),
  S('tehri', 'New Tehri', 'Uttarakhand', 30.3783, 78.4803, 24000, 'phyllite'),
  S('uttarkashi', 'Uttarkashi', 'Uttarakhand', 30.7268, 78.4354, 16000, 'phyllite'),
  S('rudraprayag', 'Rudraprayag', 'Uttarakhand', 30.2844, 78.9811, 9000, 'phyllite'),
  S('gopeshwar', 'Gopeshwar (Chamoli)', 'Uttarakhand', 30.4086, 79.3203, 22000, 'phyllite'),
  S('joshimath', 'Joshimath', 'Uttarakhand', 30.555, 79.5648, 17000, 'colluvium'),
  S('nainital', 'Nainital', 'Uttarakhand', 29.3919, 79.4542, 41000, 'phyllite'),
  S('almora', 'Almora', 'Uttarakhand', 29.5971, 79.6591, 35000, 'phyllite'),
  S('pithoragarh', 'Pithoragarh', 'Uttarakhand', 29.5829, 80.2182, 56000, 'phyllite'),
  // ---- Jammu & Kashmir, Ladakh ----
  S('udhampur', 'Udhampur', 'Jammu & Kashmir', 32.916, 75.1416, 90000, 'sandstone_shale'),
  S('katra', 'Katra', 'Jammu & Kashmir', 32.9916, 74.9455, 9000, 'sandstone_shale'),
  S('ramban', 'Ramban', 'Jammu & Kashmir', 33.2432, 75.2467, 10000, 'sandstone_shale'),
  S('banihal', 'Banihal', 'Jammu & Kashmir', 33.4381, 75.1938, 8000, 'sandstone_shale'),
  S('doda', 'Doda', 'Jammu & Kashmir', 33.1493, 75.5481, 15000, 'phyllite'),
  S('kishtwar', 'Kishtwar', 'Jammu & Kashmir', 33.3116, 75.7676, 15000, 'phyllite'),
  S('leh', 'Leh', 'Ladakh', 34.1526, 77.5771, 31000, 'colluvium'),
  S('kargil', 'Kargil', 'Ladakh', 34.5539, 76.1349, 16000, 'colluvium'),
  // ---- Maharashtra (northern Western Ghats) ----
  S('lonavala', 'Lonavala', 'Maharashtra', 18.7546, 73.4062, 57000, 'basalt'),
  S('mahad', 'Mahad (Raigad)', 'Maharashtra', 18.0833, 73.4167, 25000, 'basalt'),
  S('mahabaleshwar', 'Mahabaleshwar', 'Maharashtra', 17.9237, 73.6586, 13000, 'basalt'),
  // ---- Karnataka ----
  S('ankola', 'Ankola (Uttara Kannada)', 'Karnataka', 14.6612, 74.3045, 20000, 'laterite'),
  S('sakleshpur', 'Sakleshpur', 'Karnataka', 12.9449, 75.7878, 20000, 'laterite'),
  S('madikeri', 'Madikeri (Kodagu)', 'Karnataka', 12.4244, 75.7382, 33000, 'granite_gneiss'),
  // ---- Kerala ----
  S('wayanad', 'Wayanad (Meppadi)', 'Kerala', 11.553, 76.136, 20000, 'laterite'),
  S('nilambur', 'Nilambur', 'Kerala', 11.28, 76.23, 46000, 'laterite'),
  S('munnar', 'Munnar', 'Kerala', 10.0889, 77.0595, 38000, 'granite_gneiss'),
  S('idukki', 'Idukki', 'Kerala', 9.8494, 76.9714, 10000, 'granite_gneiss'),
  // ---- Tamil Nadu (Nilgiris, Palani hills) ----
  S('ooty', 'Udhagamandalam (Ooty)', 'Tamil Nadu', 11.4102, 76.695, 88000, 'granite_gneiss'),
  S('coonoor', 'Coonoor', 'Tamil Nadu', 11.353, 76.7959, 50000, 'granite_gneiss'),
  S('kodaikanal', 'Kodaikanal', 'Tamil Nadu', 10.2381, 77.4892, 36000, 'granite_gneiss'),
  // ---- Eastern Ghats (Andhra Pradesh, Odisha) ----
  S('araku', 'Araku Valley', 'Andhra Pradesh', 18.3273, 82.8759, 6000, 'granite_gneiss'),
  S('koraput', 'Koraput', 'Odisha', 18.812, 82.711, 41000, 'granite_gneiss'),
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
  { id: 'slg-darjeeling', name: 'Siliguri - Kurseong - Darjeeling', pts: [P(26.7271, 88.3953), P(26.8814, 88.2776), P(27.041, 88.2663)] },
  { id: 'shimla-manali', name: 'Shimla - Mandi - Kullu - Manali', pts: [P(31.1048, 77.1734), P(31.708, 76.9318), P(31.9579, 77.1095), P(32.2396, 77.1887)] },
  { id: 'rishikesh-badrinath', name: 'Rishikesh - Rudraprayag - Chamoli - Joshimath', pts: [P(30.0869, 78.2676), P(30.2844, 78.9811), P(30.4086, 79.3203), P(30.555, 79.5648)] },
  { id: 'rishikesh-uttarkashi', name: 'Rishikesh - New Tehri - Uttarkashi', pts: [P(30.0869, 78.2676), P(30.3783, 78.4803), P(30.7268, 78.4354)] },
  { id: 'jammu-srinagar', name: 'Jammu - Udhampur - Ramban - Banihal - Srinagar', pts: [P(32.7266, 74.857), P(32.916, 75.1416), P(33.2432, 75.2467), P(33.4381, 75.1938), P(34.0837, 74.7973)] },
  { id: 'panvel-pune', name: 'Panvel - Khopoli - Lonavala - Pune (ghat section)', pts: [P(18.9894, 73.1175), P(18.7866, 73.3454), P(18.7546, 73.4062), P(18.5204, 73.8567)] },
  { id: 'mahad-mahabaleshwar', name: 'Mahad - Mahabaleshwar', pts: [P(18.0833, 73.4167), P(17.9237, 73.6586)] },
  { id: 'mangaluru-sakleshpur', name: 'Mangaluru - Shiradi Ghat - Sakleshpur', pts: [P(12.9141, 74.856), P(12.9449, 75.7878)] },
  { id: 'kozhikode-wayanad', name: 'Kozhikode - Thamarassery Ghat - Wayanad', pts: [P(11.2588, 75.7804), P(11.553, 76.136)] },
  { id: 'kothamangalam-munnar', name: 'Kothamangalam - Munnar', pts: [P(10.06, 76.628), P(10.0889, 77.0595)] },
  { id: 'mettupalayam-ooty', name: 'Mettupalayam - Coonoor - Ooty', pts: [P(11.299, 76.94), P(11.353, 76.7959), P(11.4102, 76.695)] },
  { id: 'vizag-araku', name: 'Visakhapatnam - Araku Valley', pts: [P(17.6868, 83.2185), P(18.3273, 82.8759)] },
];

export const STATES = [...new Set(SITES.map((s) => s.state))].sort();

// Waypoints (towns along each corridor). scripts/build-roads.js routes along the real road network between these.
export const ROAD_WAYPOINTS = ROADS.map((r) => ({ id: r.id, name: r.name, pts: r.pts.map((p) => ({ ...p })) }));

// If server/data/roads.json exists (made by scripts/build-roads.js from OpenStreetMap), it replaces the hand-drawn alignments.
try {
  const real = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'roads.json'), 'utf8'));
  for (const r of ROADS) if (Array.isArray(real[r.id]) && real[r.id].length > 1) r.pts = real[r.id];
} catch {}
