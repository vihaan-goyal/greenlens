// Pure data — a small, hand-labeled, held-out evaluation set for the logistic
// matcher. These pairs are judged by a human (not synthesized), so they are an
// honest check that a model trained on the synthetic catalog distribution
// generalizes to real "are these the same product?" calls. Kept deliberately
// hard: same-brand siblings, shade/SPF/AM-PM variants, barcode-format dupes,
// variant-SKU refills, and generic-name cross-brand collisions.
//
// Never train on this file — it is the exam, not the textbook.

import type { Brand } from '../domain/types';
import type { MatchableItem } from './features';

export const EVAL_BRANDS: Brand[] = [
  { id: 'cerave', name: 'CeraVe', aliases: ['cera ve'] },
  { id: 'ordinary', name: 'The Ordinary', aliases: ['ordinary'] },
  { id: 'lrp', name: 'La Roche-Posay', aliases: ['la roche posay', 'larocheposay'] },
  { id: 'fenty', name: 'Fenty Beauty', aliases: ['fenty'] },
  { id: 'aveeno', name: 'Aveeno', aliases: [] },
  { id: 'fernfield', name: 'Fern & Field', aliases: ['fern and field', 'fern field'] },
];

export interface EvalPair {
  a: MatchableItem;
  b: MatchableItem;
  isMatch: boolean;
  note: string;
}

const ceraveCreamInci = [
  'aqua', 'glycerin', 'cetearyl alcohol', 'caprylic capric triglyceride',
  'ceramide np', 'ceramide ap', 'ceramide eop', 'hyaluronic acid', 'cholesterol',
  'phenoxyethanol', 'dimethicone',
];
const ordinaryNiaInci = [
  'aqua', 'niacinamide', 'pentylene glycol', 'zinc pca', 'tamarindus indica seed gum',
  'xanthan gum', 'phenoxyethanol', 'chlorphenesin',
];

export const EVAL_PAIRS: EvalPair[] = [
  // ── true matches ────────────────────────────────────────────────────────────
  {
    isMatch: true,
    note: 'same product, UPC-A vs EAN-13 of the same barcode',
    a: { id: 'e1a', brand: 'CeraVe', name: 'Moisturizing Cream', gtin: '301871239019', sizeValue: 539, sizeUnit: 'g', ingredients: ceraveCreamInci },
    b: { id: 'e1b', brand: 'CeraVe', name: 'CeraVe Moisturizing Cream', gtin: '0301871239019', sizeValue: 539, sizeUnit: 'g', ingredients: ceraveCreamInci },
  },
  {
    isMatch: true,
    note: 'catalog name vs long Amazon marketing title, no barcode on the page',
    a: { id: 'e2a', brand: 'CeraVe', name: 'Moisturizing Cream', ingredients: ceraveCreamInci },
    b: {
      id: 'e2b', brand: 'CeraVe',
      name: 'CeraVe Moisturizing Cream for Normal to Dry Skin, Body and Face Moisturizer with Hyaluronic Acid and Ceramides, Fragrance Free, 19 Oz',
      ingredients: ceraveCreamInci,
    },
  },
  {
    isMatch: true,
    note: 'The Ordinary serum, catalog vs Amazon title with extra marketing tokens',
    a: { id: 'e3a', brand: 'The Ordinary', name: 'Niacinamide 10% + Zinc 1%', sizeValue: 30, sizeUnit: 'ml', ingredients: ordinaryNiaInci },
    b: { id: 'e3b', brand: 'The Ordinary', name: 'The Ordinary Niacinamide 10% + Zinc 1% Oil Control Serum 30ml', sizeValue: 30, sizeUnit: 'ml', ingredients: ordinaryNiaInci },
  },
  {
    isMatch: true,
    note: 'brand alias spelling: "La Roche-Posay" vs "La Roche Posay", same product',
    a: { id: 'e4a', brand: 'La Roche-Posay', name: 'Cicaplast Baume B5', sizeValue: 40, sizeUnit: 'ml' },
    b: { id: 'e4b', brand: 'La Roche Posay', name: 'Cicaplast Baume B5 Soothing Balm 40ml' , sizeValue: 40, sizeUnit: 'ml' },
  },
  {
    isMatch: true,
    note: 'indie brand written two ways, no barcode',
    a: { id: 'e5a', brand: 'Fern & Field', name: 'Bare Ceramide Cream', ingredients: ['aqua', 'glycerin', 'ceramide np', 'squalane', 'panthenol'] },
    b: { id: 'e5b', brand: 'fern and field', name: 'Bare Ceramide Cream (Fragrance-Free)', ingredients: ['aqua', 'glycerin', 'ceramide np', 'squalane', 'panthenol'] },
  },
  {
    isMatch: true,
    note: 'variant-SKU refill: different UPC, same canonical product',
    a: { id: 'e6a', brand: 'CeraVe', name: 'Hydrating Facial Cleanser', gtin: '301871239521', ingredients: ['aqua', 'glycerin', 'ceramide np', 'hyaluronic acid', 'cholesterol', 'phenoxyethanol'] },
    b: { id: 'e6b', brand: 'CeraVe', name: 'CeraVe Hydrating Facial Cleanser Refill', gtin: '888888888881', ingredients: ['aqua', 'glycerin', 'ceramide np', 'hyaluronic acid', 'cholesterol', 'phenoxyethanol'] },
  },
  {
    isMatch: true,
    note: 'page truncates the ingredient list to actives only',
    a: { id: 'e7a', brand: 'The Ordinary', name: 'Hyaluronic Acid 2% + B5', sizeValue: 30, sizeUnit: 'ml', ingredients: ['aqua', 'sodium hyaluronate', 'panthenol', 'pentylene glycol', 'propanediol', 'phenoxyethanol'] },
    b: { id: 'e7b', brand: 'The Ordinary', name: 'The Ordinary Hyaluronic Acid 2% + B5 Hydrating Serum', sizeValue: 30, sizeUnit: 'ml', ingredients: ['aqua', 'sodium hyaluronate', 'panthenol'] },
  },
  {
    isMatch: true,
    note: 'Aveeno lotion, catalog vs Amazon title (the classic length-gap case)',
    a: { id: 'e8a', brand: 'Aveeno', name: 'Daily Moisturizing Lotion', ingredients: ['water', 'glycerin', 'distearyldimonium chloride', 'petrolatum', 'isopropyl palmitate', 'avena sativa', 'dimethicone'] },
    b: { id: 'e8b', brand: 'Aveeno', name: 'Aveeno Daily Moisturizing Body Lotion with Prebiotic Oat for Dry Skin, Fragrance Free, 18 Fl Oz', ingredients: ['water', 'glycerin', 'distearyldimonium chloride', 'petrolatum', 'isopropyl palmitate', 'avena sativa', 'dimethicone'] },
  },
  {
    isMatch: true,
    note: 'Fenty foundation, same shade, catalog vs Amazon title',
    a: { id: 'e9a', brand: 'Fenty Beauty', name: "Pro Filt'r Soft Matte Longwear Foundation 150" },
    b: { id: 'e9b', brand: 'Fenty', name: "Fenty Beauty Pro Filt'r Soft Matte Longwear Liquid Foundation Shade 150, 32ml", sizeValue: 32, sizeUnit: 'ml' },
  },
  {
    isMatch: true,
    note: 'La Roche-Posay sunscreen, alias + marketing title',
    a: { id: 'e10a', brand: 'La Roche-Posay', name: 'Anthelios Melt-in Milk Sunscreen SPF 60', sizeValue: 150, sizeUnit: 'ml' },
    b: { id: 'e10b', brand: 'larocheposay', name: 'La Roche-Posay Anthelios Melt-in Milk Body & Face Sunscreen SPF 60, 5.0 Fl Oz', sizeValue: 150, sizeUnit: 'ml' },
  },

  // ── true non-matches ──────────────────────────────────────────────────────────
  {
    isMatch: false,
    note: 'same brand, different products: cream vs cleanser',
    a: { id: 'n1a', brand: 'CeraVe', name: 'Moisturizing Cream', ingredients: ceraveCreamInci },
    b: { id: 'n1b', brand: 'CeraVe', name: 'CeraVe Foaming Facial Cleanser for Oily Skin', ingredients: ['aqua', 'cocamidopropyl hydroxysultaine', 'glycerin', 'niacinamide', 'ceramide np', 'phenoxyethanol'] },
  },
  {
    isMatch: false,
    note: 'same brand siblings: cream vs lotion',
    a: { id: 'n2a', brand: 'CeraVe', name: 'Moisturizing Cream', ingredients: ceraveCreamInci },
    b: { id: 'n2b', brand: 'CeraVe', name: 'CeraVe Daily Moisturizing Lotion', ingredients: ['aqua', 'glycerin', 'caprylic capric triglyceride', 'ceramide np', 'hyaluronic acid', 'dimethicone'] },
  },
  {
    isMatch: false,
    note: 'The Ordinary siblings: niacinamide serum vs hyaluronic serum',
    a: { id: 'n3a', brand: 'The Ordinary', name: 'Niacinamide 10% + Zinc 1%', sizeValue: 30, sizeUnit: 'ml', ingredients: ordinaryNiaInci },
    b: { id: 'n3b', brand: 'The Ordinary', name: 'The Ordinary Hyaluronic Acid 2% + B5 Serum', sizeValue: 30, sizeUnit: 'ml', ingredients: ['aqua', 'sodium hyaluronate', 'panthenol', 'pentylene glycol', 'propanediol', 'phenoxyethanol'] },
  },
  {
    isMatch: false,
    note: 'Fenty foundation, different shade (150 vs 350) — different product',
    a: { id: 'n4a', brand: 'Fenty Beauty', name: "Pro Filt'r Soft Matte Longwear Foundation 150" },
    b: { id: 'n4b', brand: 'Fenty Beauty', name: "Pro Filt'r Soft Matte Longwear Foundation 350" },
  },
  {
    isMatch: false,
    note: 'La Roche-Posay Anthelios SPF 60 vs SPF 30 — different product',
    a: { id: 'n5a', brand: 'La Roche-Posay', name: 'Anthelios Melt-in Milk Sunscreen SPF 60', sizeValue: 150, sizeUnit: 'ml' },
    b: { id: 'n5b', brand: 'La Roche-Posay', name: 'Anthelios Melt-in Milk Sunscreen SPF 30', sizeValue: 150, sizeUnit: 'ml' },
  },
  {
    isMatch: false,
    note: 'CeraVe AM (with SPF) vs PM facial lotion — different product',
    a: { id: 'n6a', brand: 'CeraVe', name: 'AM Facial Moisturizing Lotion SPF 30', ingredients: ['aqua', 'homosalate', 'glycerin', 'octocrylene', 'ceramide np', 'niacinamide', 'phenoxyethanol'] },
    b: { id: 'n6b', brand: 'CeraVe', name: 'PM Facial Moisturizing Lotion', ingredients: ['aqua', 'glycerin', 'niacinamide', 'ceramide np', 'hyaluronic acid', 'dimethicone', 'phenoxyethanol'] },
  },
  {
    isMatch: false,
    note: 'generic name collision across brands: Aveeno vs CeraVe daily lotion',
    a: { id: 'n7a', brand: 'Aveeno', name: 'Daily Moisturizing Lotion', ingredients: ['water', 'glycerin', 'distearyldimonium chloride', 'petrolatum', 'avena sativa', 'dimethicone'] },
    b: { id: 'n7b', brand: 'CeraVe', name: 'Daily Moisturizing Lotion', ingredients: ['aqua', 'glycerin', 'caprylic capric triglyceride', 'ceramide np', 'hyaluronic acid', 'dimethicone'] },
  },
  {
    isMatch: false,
    note: 'indie siblings: ceramide cream vs rosehip oil',
    a: { id: 'n8a', brand: 'Fern & Field', name: 'Bare Ceramide Cream', ingredients: ['aqua', 'glycerin', 'ceramide np', 'squalane', 'panthenol'] },
    b: { id: 'n8b', brand: 'fern and field', name: 'Fern & Field Rosehip Facial Oil', ingredients: ['rosa canina seed oil', 'tocopherol', 'helianthus annuus seed oil'] },
  },
  {
    isMatch: false,
    note: 'The Ordinary retinoid strengths: 2% vs 5% granactive — different product',
    a: { id: 'n9a', brand: 'The Ordinary', name: 'Granactive Retinoid 2% Emulsion', sizeValue: 30, sizeUnit: 'ml' },
    b: { id: 'n9b', brand: 'The Ordinary', name: 'Granactive Retinoid 5% in Squalane', sizeValue: 30, sizeUnit: 'ml' },
  },
  {
    isMatch: false,
    note: 'different brand, different product, overlapping category words',
    a: { id: 'n10a', brand: 'La Roche-Posay', name: 'Effaclar Duo Acne Treatment', ingredients: ['aqua', 'glycerin', 'niacinamide', 'salicylic acid', 'zinc pca', 'phenoxyethanol'] },
    b: { id: 'n10b', brand: 'CeraVe', name: 'Acne Foaming Cream Cleanser', ingredients: ['aqua', 'benzoyl peroxide', 'glycerin', 'ceramide np', 'hyaluronic acid', 'phenoxyethanol'] },
  },
];
