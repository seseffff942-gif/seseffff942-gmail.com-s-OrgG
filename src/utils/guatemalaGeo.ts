// Utility dictionary and resolver for Guatemala municipalities and locations

export interface GeoLocationResult {
  latitude: number;
  longitude: number;
  isExact: boolean;
  source: 'gps' | 'municipality' | 'department';
  locationLabel: string;
}

// Coordinates for key municipalities and departments in Guatemala
export const GUATEMALA_LOCATIONS: Record<string, { lat: number; lng: number; dept: string }> = {
  // PETÉN
  'san benito': { lat: 16.9186, lng: -89.9142, dept: 'Petén' },
  'santa elena': { lat: 16.9174, lng: -89.8973, dept: 'Petén' },
  'flores': { lat: 16.9242, lng: -89.8898, dept: 'Petén' },
  'sayaxche': { lat: 16.5258, lng: -90.1878, dept: 'Petén' },
  'sayaxché': { lat: 16.5258, lng: -90.1878, dept: 'Petén' },
  'poptun': { lat: 16.3267, lng: -89.4194, dept: 'Petén' },
  'poptún': { lat: 16.3267, lng: -89.4194, dept: 'Petén' },
  'san luis': { lat: 16.1983, lng: -89.4408, dept: 'Petén' },
  'melchor de mencos': { lat: 17.0622, lng: -89.1558, dept: 'Petén' },
  'dolores': { lat: 16.5139, lng: -89.4161, dept: 'Petén' },
  'san andres': { lat: 16.9744, lng: -89.9114, dept: 'Petén' },
  'san andrés': { lat: 16.9744, lng: -89.9114, dept: 'Petén' },
  'san jose': { lat: 16.9839, lng: -89.8967, dept: 'Petén' },
  'san josé': { lat: 16.9839, lng: -89.8967, dept: 'Petén' },
  'la libertad': { lat: 16.7872, lng: -90.1172, dept: 'Petén' },
  'las cruces': { lat: 16.6358, lng: -90.5283, dept: 'Petén' },
  'el chal': { lat: 16.6367, lng: -89.6517, dept: 'Petén' },
  'santa ana': { lat: 16.8058, lng: -89.8286, dept: 'Petén' },
  'peten': { lat: 16.9186, lng: -89.9142, dept: 'Petén' },
  'petén': { lat: 16.9186, lng: -89.9142, dept: 'Petén' },

  // SANTA ROSA
  'cuilapa': { lat: 14.2769, lng: -90.2989, dept: 'Santa Rosa' },
  'barberena': { lat: 14.3094, lng: -90.3606, dept: 'Santa Rosa' },
  'chiquimulilla': { lat: 14.0847, lng: -90.3831, dept: 'Santa Rosa' },
  'guazacapan': { lat: 14.0736, lng: -90.4186, dept: 'Santa Rosa' },
  'guazacapán': { lat: 14.0736, lng: -90.4186, dept: 'Santa Rosa' },
  'nueva santa rosa': { lat: 14.3808, lng: -90.2764, dept: 'Santa Rosa' },
  'casillas': { lat: 14.4222, lng: -90.2458, dept: 'Santa Rosa' },
  'san rafael las flores': { lat: 14.4811, lng: -90.1742, dept: 'Santa Rosa' },
  'taxisco': { lat: 14.0672, lng: -90.4633, dept: 'Santa Rosa' },
  'santa rosa de lima': { lat: 14.3886, lng: -90.3958, dept: 'Santa Rosa' },
  'santa rosa': { lat: 14.2769, lng: -90.2989, dept: 'Santa Rosa' },

  // ALTA VERAPAZ
  'coban': { lat: 15.4700, lng: -90.3700, dept: 'Alta Verapaz' },
  'cobán': { lat: 15.4700, lng: -90.3700, dept: 'Alta Verapaz' },
  'carcha': { lat: 15.4858, lng: -90.3117, dept: 'Alta Verapaz' },
  'carchá': { lat: 15.4858, lng: -90.3117, dept: 'Alta Verapaz' },
  'san pedro carcha': { lat: 15.4858, lng: -90.3117, dept: 'Alta Verapaz' },
  'san juan chamelco': { lat: 15.4300, lng: -90.3200, dept: 'Alta Verapaz' },
  'tactic': { lat: 15.3167, lng: -90.3500, dept: 'Alta Verapaz' },
  'chisec': { lat: 15.8167, lng: -90.2833, dept: 'Alta Verapaz' },
  'fay': { lat: 15.8667, lng: -90.4833, dept: 'Alta Verapaz' },
  'fray bartolome': { lat: 15.8667, lng: -90.4833, dept: 'Alta Verapaz' },
  'alta verapaz': { lat: 15.4700, lng: -90.3700, dept: 'Alta Verapaz' },

  // BAJA VERAPAZ
  'salama': { lat: 15.1028, lng: -90.3181, dept: 'Baja Verapaz' },
  'salamá': { lat: 15.1028, lng: -90.3181, dept: 'Baja Verapaz' },
  'rabinal': { lat: 15.0833, lng: -90.4833, dept: 'Baja Verapaz' },
  'san jeronimo': { lat: 15.0600, lng: -90.2394, dept: 'Baja Verapaz' },
  'san jerónimo': { lat: 15.0600, lng: -90.2394, dept: 'Baja Verapaz' },
  'purulha': { lat: 15.2333, lng: -90.2000, dept: 'Baja Verapaz' },
  'purulhá': { lat: 15.2333, lng: -90.2000, dept: 'Baja Verapaz' },
  'baja verapaz': { lat: 15.1028, lng: -90.3181, dept: 'Baja Verapaz' },

  // GUATEMALA CAPITAL Y METRO
  'guatemala': { lat: 14.6349, lng: -90.5069, dept: 'Guatemala' },
  'ciudad de guatemala': { lat: 14.6349, lng: -90.5069, dept: 'Guatemala' },
  'mixco': { lat: 14.6300, lng: -90.6067, dept: 'Guatemala' },
  'villa nueva': { lat: 14.5256, lng: -90.5886, dept: 'Guatemala' },
  'amatitlan': { lat: 14.4833, lng: -90.6167, dept: 'Guatemala' },
  'amatitlán': { lat: 14.4833, lng: -90.6167, dept: 'Guatemala' },
  'san miguel petapa': { lat: 14.5000, lng: -90.5600, dept: 'Guatemala' },
  'santa catarina pinula': { lat: 14.5700, lng: -90.4958, dept: 'Guatemala' },
  'san juan sacatepequez': { lat: 14.7189, lng: -90.6436, dept: 'Guatemala' },
  'san juan sacatepéquez': { lat: 14.7189, lng: -90.6436, dept: 'Guatemala' },

  // QUETZALTENANGO
  'quetzaltenango': { lat: 14.8347, lng: -91.5181, dept: 'Quetzaltenango' },
  'xela': { lat: 14.8347, lng: -91.5181, dept: 'Quetzaltenango' },
  'coatepeque': { lat: 14.7000, lng: -91.8667, dept: 'Quetzaltenango' },
  'salcaja': { lat: 14.8833, lng: -91.4667, dept: 'Quetzaltenango' },
  'salcajá': { lat: 14.8833, lng: -91.4667, dept: 'Quetzaltenango' },

  // ESCUINTLA
  'escuintla': { lat: 14.3009, lng: -90.7850, dept: 'Escuintla' },
  'santa lucia cotzumalguapa': { lat: 14.3333, lng: -91.0167, dept: 'Escuintla' },
  'santa lucía cotzumalguapa': { lat: 14.3333, lng: -91.0167, dept: 'Escuintla' },
  'puerto san jose': { lat: 13.9292, lng: -90.8208, dept: 'Escuintla' },
  'palin': { lat: 14.4056, lng: -90.6972, dept: 'Escuintla' },
  'palín': { lat: 14.4056, lng: -90.6972, dept: 'Escuintla' },
  'puerto quetzal': { lat: 13.9317, lng: -90.7878, dept: 'Escuintla' },

  // ZACAPA
  'zacapa': { lat: 14.9722, lng: -89.5306, dept: 'Zacapa' },
  'estanzuela': { lat: 15.0000, lng: -89.5667, dept: 'Zacapa' },
  'rio hondo': { lat: 15.0500, lng: -89.5833, dept: 'Zacapa' },
  'río hondo': { lat: 15.0500, lng: -89.5833, dept: 'Zacapa' },
  'gualan': { lat: 15.1167, lng: -89.3667, dept: 'Zacapa' },
  'gualán': { lat: 15.1167, lng: -89.3667, dept: 'Zacapa' },
  'teculutan': { lat: 14.9833, lng: -89.7167, dept: 'Zacapa' },
  'teculután': { lat: 14.9833, lng: -89.7167, dept: 'Zacapa' },

  // CHIQUIMULA
  'chiquimula': { lat: 14.8000, lng: -89.5458, dept: 'Chiquimula' },
  'esquipulas': { lat: 14.5667, lng: -89.3500, dept: 'Chiquimula' },
  'ipala': { lat: 14.6167, lng: -89.6167, dept: 'Chiquimula' },

  // IZABAL
  'puerto barrios': { lat: 15.7278, lng: -88.5944, dept: 'Izabal' },
  'morales': { lat: 15.4833, lng: -88.8167, dept: 'Izabal' },
  'los amates': { lat: 15.2500, lng: -89.1000, dept: 'Izabal' },
  'livingston': { lat: 15.8267, lng: -88.7511, dept: 'Izabal' },
  'izabal': { lat: 15.7278, lng: -88.5944, dept: 'Izabal' },

  // JUTIAPA
  'jutiapa': { lat: 14.2817, lng: -89.8958, dept: 'Jutiapa' },
  'asuncion mita': { lat: 14.3308, lng: -89.7108, dept: 'Jutiapa' },
  'asunción mita': { lat: 14.3308, lng: -89.7108, dept: 'Jutiapa' },
  'santa catarina mita': { lat: 14.4500, lng: -89.7500, dept: 'Jutiapa' },

  // JALAPA
  'jalapa': { lat: 14.6347, lng: -89.9889, dept: 'Jalapa' },
  'monjas': { lat: 14.5000, lng: -89.8667, dept: 'Jalapa' },
  'san pedro pinula': { lat: 14.6667, lng: -89.8500, dept: 'Jalapa' },

  // EL PROGRESO
  'guastatoya': { lat: 14.8542, lng: -90.0758, dept: 'El Progreso' },
  'sanarate': { lat: 14.7833, lng: -90.2000, dept: 'El Progreso' },

  // SUCHITEPÉQUEZ
  'mazatenango': { lat: 14.5342, lng: -91.5033, dept: 'Suchitepéquez' },
  'chicacao': { lat: 14.5447, lng: -91.3267, dept: 'Suchitepéquez' },

  // RETALHULEU
  'retalhuleu': { lat: 14.5361, lng: -91.6778, dept: 'Retalhuleu' },
  'champerico': { lat: 14.2936, lng: -91.9131, dept: 'Retalhuleu' },

  // SAN MARCOS
  'san marcos': { lat: 14.9639, lng: -91.7944, dept: 'San Marcos' },
  'malacatan': { lat: 14.9100, lng: -92.0583, dept: 'San Marcos' },
  'malacatán': { lat: 14.9100, lng: -92.0583, dept: 'San Marcos' },

  // HUEHUETENANGO
  'huehuetenango': { lat: 15.3197, lng: -91.4708, dept: 'Huehuetenango' },
  'barillas': { lat: 15.8047, lng: -91.3142, dept: 'Huehuetenango' },

  // QUICHÉ
  'santa cruz del quiche': { lat: 15.0306, lng: -91.1486, dept: 'Quiché' },
  'santa cruz del quiché': { lat: 15.0306, lng: -91.1486, dept: 'Quiché' },
  'quiche': { lat: 15.0306, lng: -91.1486, dept: 'Quiché' },
  'quiché': { lat: 15.0306, lng: -91.1486, dept: 'Quiché' },
  'joyabaj': { lat: 14.9833, lng: -90.8000, dept: 'Quiché' },

  // CHIMALTENANGO
  'chimaltenango': { lat: 14.6611, lng: -90.8208, dept: 'Chimaltenango' },
  'tecpan': { lat: 14.7619, lng: -90.9933, dept: 'Chimaltenango' },
  'tecpán': { lat: 14.7619, lng: -90.9933, dept: 'Chimaltenango' },

  // SACATEPÉQUEZ
  'antigua guatemala': { lat: 14.5586, lng: -90.7297, dept: 'Sacatepéquez' },
  'antigua': { lat: 14.5586, lng: -90.7297, dept: 'Sacatepéquez' },

  // SOLOLÁ
  'solola': { lat: 14.7725, lng: -91.1839, dept: 'Sololá' },
  'sololá': { lat: 14.7725, lng: -91.1839, dept: 'Sololá' },
  'panajachel': { lat: 14.7417, lng: -91.1556, dept: 'Sololá' },

  // TOTONICAPÁN
  'totonicapan': { lat: 14.9117, lng: -91.3611, dept: 'Totonicapán' },
  'totonicapán': { lat: 14.9117, lng: -91.3611, dept: 'Totonicapán' }
};

// Generates small deterministic dispersion around center so markers in same city don't overlay 100%
function getDeterministicOffset(seedStr: string): { dLat: number; dLng: number } {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const norm1 = ((Math.abs(hash) % 1000) / 1000) - 0.5; // -0.5 to 0.5
  const norm2 = ((Math.abs(hash >> 3) % 1000) / 1000) - 0.5;
  // ~300 to 500 meters dispersion (0.003 degrees ~ 330 meters)
  return {
    dLat: norm1 * 0.005,
    dLng: norm2 * 0.005
  };
}

export function resolveClientLocation(client: {
  id?: string;
  name: string;
  companyName?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): GeoLocationResult | null {
  // 1. Priority 1: Exact GPS coordinates already saved
  if (
    client.latitude != null &&
    client.longitude != null &&
    !isNaN(Number(client.latitude)) &&
    !isNaN(Number(client.longitude)) &&
    Number(client.latitude) !== 0 &&
    Number(client.longitude) !== 0
  ) {
    return {
      latitude: Number(client.latitude),
      longitude: Number(client.longitude),
      isExact: true,
      source: 'gps',
      locationLabel: 'Coordenadas GPS exactas'
    };
  }

  // 2. Priority 2: Extract locality from address text, company name, or client name
  const textToSearch = [
    client.address || '',
    client.companyName || '',
    client.name || ''
  ].join(' ').toLowerCase();

  // Normalize accents and punctuation for robust matching
  const normalizedText = textToSearch
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, ' ');

  // Sort locations by keyword length descending to match "san benito" before "san"
  const locationKeys = Object.keys(GUATEMALA_LOCATIONS).sort((a, b) => b.length - a.length);

  for (const key of locationKeys) {
    const normalizedKey = key
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // Check whole word or substring boundary
    const regex = new RegExp(`\\b${normalizedKey}\\b`, 'i');
    if (regex.test(normalizedText)) {
      const loc = GUATEMALA_LOCATIONS[key];
      const offset = getDeterministicOffset(client.id || client.name);
      return {
        latitude: loc.lat + offset.dLat,
        longitude: loc.lng + offset.dLng,
        isExact: false,
        source: 'municipality',
        locationLabel: `Aprox. ${key.toUpperCase()} (${loc.dept})`
      };
    }
  }

  return null;
}
