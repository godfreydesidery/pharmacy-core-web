import { ProductType, TrackingMode, UnitOfMeasure } from '../api/models';
import { Tone } from '../format/format';

/** How each product type looks: a label, an icon, a tone and a one-line description. */
export const PRODUCT_TYPES: {
  code: ProductType;
  label: string;
  icon: string;
  tone: Tone | 'teal' | 'orange';
  hint: string;
}[] = [
  {
    code: 'MEDICINE',
    label: 'Medicine',
    icon: 'pill',
    tone: 'blue',
    hint: 'Batches with expiry, dosage form, dispensing class',
  },
  {
    code: 'MEDICAL_EQUIPMENT',
    label: 'Equipment',
    icon: 'wheelchair',
    tone: 'purple',
    hint: 'Wheelchairs, BP monitors — serial numbers & warranty',
  },
  {
    code: 'MEDICAL_SUPPLY',
    label: 'Supplies',
    icon: 'bandage',
    tone: 'teal',
    hint: 'Gloves, dressings, syringes',
  },
  {
    code: 'COSMETIC',
    label: 'Personal care',
    icon: 'sparkles',
    tone: 'amber',
    hint: 'Creams, soaps, cosmetics',
  },
  {
    code: 'SUPPLEMENT',
    label: 'Supplement',
    icon: 'leaf',
    tone: 'green',
    hint: 'Vitamins and nutrition',
  },
  {
    code: 'BABY_CARE',
    label: 'Mother & baby',
    icon: 'baby',
    tone: 'red',
    hint: 'Baby food, diapers, care',
  },
  {
    code: 'OTHER',
    label: 'Other',
    icon: 'tag',
    tone: 'gray',
    hint: 'Anything else the pharmacy sells',
  },
];

export const TRACKING_MODES: { code: TrackingMode; label: string; hint: string }[] = [
  { code: 'BATCH_EXPIRY', label: 'Batch & expiry', hint: 'Earliest expiry sold first (FEFO)' },
  { code: 'BATCH', label: 'Batch, no expiry', hint: 'First in, first out (FIFO)' },
  { code: 'SERIAL', label: 'Serial number', hint: 'Each unit by its serial number' },
  { code: 'QUANTITY', label: 'Quantity only', hint: 'Counted, no batches' },
];

export const UNITS: UnitOfMeasure[] = [
  'PIECE',
  'BOX',
  'PACK',
  'STRIP',
  'BOTTLE',
  'TUBE',
  'SACHET',
  'VIAL',
  'PAIR',
  'SET',
  'KIT',
  'ROLL',
];

const DEFAULT_TRACKING: Record<ProductType, TrackingMode> = {
  MEDICINE: 'BATCH_EXPIRY',
  MEDICAL_EQUIPMENT: 'SERIAL',
  MEDICAL_SUPPLY: 'BATCH',
  COSMETIC: 'BATCH',
  SUPPLEMENT: 'BATCH',
  BABY_CARE: 'BATCH',
  OTHER: 'BATCH',
};

export function defaultTracking(type: ProductType | null | undefined): TrackingMode {
  return DEFAULT_TRACKING[type ?? 'MEDICINE'];
}

export function productTypeOf(type: ProductType | string | null | undefined) {
  return PRODUCT_TYPES.find((t) => t.code === type) ?? PRODUCT_TYPES[0];
}

/** Whether stock of a product with this tracking carries an expiry date. */
export function tracksExpiry(mode: TrackingMode | string | null | undefined): boolean {
  return (mode ?? 'BATCH_EXPIRY') === 'BATCH_EXPIRY';
}

/** Parses pasted serial numbers: one per line, or separated by commas or spaces. */
export function parseSerials(text: string | null | undefined): string[] {
  return [
    ...new Set(
      (text ?? '')
        .split(/[\n,;\t ]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}
