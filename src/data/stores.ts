import type { StoreMeta } from '../types';

export const STORES: StoreMeta[] = [
  {
    id: 'jewel-osco',
    label: 'Jewel-Osco',
    short: 'Jewel',
    color: '#c8102e',
    flippMerchantHints: ['jewel', 'jewel-osco', 'jewel osco'],
  },
  {
    id: 'aldi',
    label: 'Aldi',
    short: 'Aldi',
    color: '#0000a0',
    flippMerchantHints: ['aldi'],
  },
  {
    id: 'target',
    label: 'Target',
    short: 'Target',
    color: '#cc0000',
    flippMerchantHints: ['target'],
  },
];

export const DEFAULT_ZIP = '60610';

/** Rough Chicagoland hint range (IL 600–608). Not a hard limit. */
export function isChicagolandZip(zip: string): boolean {
  const n = Number(zip.slice(0, 3));
  return Number.isFinite(n) && n >= 600 && n <= 608;
}

export function isValidUsZip(zip: string): boolean {
  return /^\d{5}$/.test(zip);
}

export function locationLabelForZip(zip: string): string {
  if (zip === '60610') return `River North / Near North Side · ZIP ${zip}`;
  if (zip === '60611') return `Near North / Streeterville · ZIP ${zip}`;
  if (isChicagolandZip(zip)) return `Chicagoland · ZIP ${zip}`;
  return `ZIP ${zip}`;
}
