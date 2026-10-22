import { OriginRegion } from './index';

/**
 * Standard Origin Regions for East African Onion Supply
 * Merchants choose a region, then specify the exact farm/ward/sub-county.
 * This structure enables future analytics on:
 * - Market uptake & customer reception
 * - Spoilage / rot resistance across regions
 * - Net profit margins per geographical origin
 */
export const PRESET_ORIGIN_REGIONS: OriginRegion[] = [
  {
    regionId: 'TZ-NORTH',
    regionName: 'Northern Tanzania (Singida / Karatu / Arusha)',
    country: 'TANZANIA',
    suggestedDistricts: [
      'Singida Urban / Rural',
      'Iramba District',
      'Karatu (Manyara)',
      'Mbulu',
      'Babati',
      'Arusha / Moshi'
    ]
  },
  {
    regionId: 'KE-KAJIADO',
    regionName: 'Kajiado South (Oloitokitok / Rom / Kimana)',
    country: 'KENYA',
    suggestedDistricts: [
      'Oloitokitok Town',
      'Rom Border Zone',
      'Kimana Plains',
      'Entonet',
      'Namanga'
    ]
  },
  {
    regionId: 'KE-RIFT',
    regionName: 'Rift Valley (Mai Mahiu / Naivasha / Gilgil)',
    country: 'KENYA',
    suggestedDistricts: [
      'Mai Mahiu / Suswa',
      'Naivasha Lake Zone',
      'Gilgil',
      'Narok East'
    ]
  },
  {
    regionId: 'KE-CENTRAL',
    regionName: 'Central Kenya (Nyeri / Kirinyaga / Mang\'u)',
    country: 'KENYA',
    suggestedDistricts: [
      'Kieni (Nyeri)',
      'Mwea (Kirinyaga)',
      'Mang\'u (Kiambu)',
      'Murang\'a North'
    ]
  },
  {
    regionId: 'KE-EASTERN',
    regionName: 'Eastern Kenya (Meru / Machakos / Embu)',
    country: 'KENYA',
    suggestedDistricts: [
      'Meru Central / Timau',
      'Embu Lower Plains',
      'Yatta (Machakos)',
      'Kibwezi'
    ]
  },
  {
    regionId: 'OTHER_CUSTOM',
    regionName: 'Other / Custom Region',
    country: 'OTHER',
    suggestedDistricts: ['Custom Town or Cooperative']
  }
];
