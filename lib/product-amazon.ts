/** Direct Amazon ASINs for each seeded product. dp/ links go straight to the listing. */
const ASINS: Record<string, string> = {
  'prod-cerave-mc':            'B01EHIUFUK', // CeraVe Moisturizing Cream 16oz
  'prod-ordinary-niacinamide': 'B01MDTVZTZ', // The Ordinary Niacinamide 10% + Zinc 1%
  'prod-olaplex-3':            'B00SNM5US4', // Olaplex No. 3 Hair Perfector
  'prod-neutrogena-hydroboost':'B00NR1YQHM', // Neutrogena Hydro Boost Water Gel 1.7oz
  'prod-laroche-toleriane':    'B01N7T7JKJ', // La Roche-Posay Toleriane Hydrating Cleanser
  'prod-eltamd-uvclear':       'B002MSN3QQ', // EltaMD UV Clear SPF 46 1.7oz
  'prod-cosrx-snail':          'B00PBX3L7K', // COSRX Snail Mucin 96% Essence 100ml
  'prod-drunk-protini':        'B07934S6WK', // Drunk Elephant Protini Polypeptide Cream 50ml
  'prod-aveeno-daily':         'B001459IEE', // Aveeno Daily Moisturizing Lotion 18oz
  'prod-maybelline-skyhigh':   'B08H3JPH74', // Maybelline Sky High Mascara Blackest Black
  'prod-burts-lipbalm':        'B0054LHI5A', // Burt's Bees Beeswax Lip Balm Original
  'prod-elf-putty':            'B0815DCF14', // e.l.f. Poreless Putty Primer 0.74oz
  'prod-glossier-balm':        'B0779J89WY', // Glossier Balm Dotcom Original Clear
  'prod-pacifica-collagen':    'B095WG14PQ', // Pacifica Vegan Collagen Overnight Recovery Cream
  'prod-paulas-bha':           'B00949CTQQ', // Paula's Choice 2% BHA Liquid Exfoliant 4oz
  'prod-cetaphil-cleanser':    'B000052YMV', // Cetaphil Gentle Skin Cleanser 16oz
  'prod-native-deo':           'B07GB3NVN1', // Native Deodorant Coconut & Vanilla 2.65oz
  'prod-ogx-argan':            'B0048F5ATO', // OGX Renewing Argan Oil Shampoo 13oz
  'prod-fab-repair':           'B00DQKZF3S', // First Aid Beauty Ultra Repair Cream 6oz
  'prod-bioderma-sensibio':    'B002XZLAWM', // Bioderma Sensibio H2O 500ml
  'prod-fenty-filtr':          'B076231YBL', // Fenty Beauty Pro Filt'r Soft Matte Foundation
};

const PARTNER_TAG = 'greenlens04-20';

export function productAmazonUrl(productId: string): string | null {
  const asin = ASINS[productId];
  return asin ? `https://www.amazon.com/dp/${asin}?tag=${PARTNER_TAG}` : null;
}

/** Reverse lookup: ASIN → Greenlens product ID. */
const ASIN_TO_PRODUCT = Object.fromEntries(
  Object.entries(ASINS).map(([productId, asin]) => [asin, productId]),
) as Record<string, string>;

export function asinToProductId(asin: string): string | null {
  return ASIN_TO_PRODUCT[asin.toUpperCase()] ?? null;
}
