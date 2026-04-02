// ISO 3166-1 alpha-2 country codes with full names
export const COUNTRY_CODES = {
  'jp': 'Japan',
  'br': 'Brazil',
  'us': 'USA',
  'it': 'Italy',
  'pl': 'Poland',
  'fr': 'France',
  'rs': 'Serbia',
  'ar': 'Argentina',
  'cu': 'Cuba',
  'ru': 'Russia',
  'kr': 'South Korea',
  'cn': 'China',
  'de': 'Germany',
  'tr': 'Turkey',
  'ca': 'Canada',
  'ir': 'Iran',
  'au': 'Australia',
  'nl': 'Netherlands',
  'mx': 'Mexico',
  'es': 'Spain',
  'th': 'Thailand',
  'me': 'Montenegro',
  'hr': 'Croatia',
  'gr': 'Greece',
  'pt': 'Portugal',
  'cz': 'Czech Republic',
  'hu': 'Hungary',
  'gb': 'England',
  'ie': 'Ireland',
  'be': 'Belgium',
  'se': 'Sweden',
  'no': 'Norway',
  'dk': 'Denmark',
  'fi': 'Finland',
  'is': 'Iceland',
} as const;

// Reverse mapping from country name to code
export const COUNTRY_NAME_TO_CODE: Record<string, string> = {};

Object.entries(COUNTRY_CODES).forEach(([code, name]) => {
  COUNTRY_NAME_TO_CODE[name] = code;
});

// Get country code from country name
export function getCountryCode(countryName: string): string {
  return COUNTRY_NAME_TO_CODE[countryName] || 'un'; // 'un' as fallback for unknown countries
}

// Get country name from country code
export function getCountryName(countryCode: string): string {
  return COUNTRY_CODES[countryCode as keyof typeof COUNTRY_CODES] || 'Unknown';
}

// All available country codes
export const AVAILABLE_COUNTRY_CODES = Object.keys(COUNTRY_CODES);
