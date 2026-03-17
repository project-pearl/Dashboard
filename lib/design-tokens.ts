/* ================================================================== */
/*  PIN Design Tokens — Single source of truth for JS-side values     */
/*  CSS-side usage: var(--*) / Tailwind classes                       */
/* ================================================================== */

/* ── Colors ── */

export const COLOR_PRIMARY = '#0B6E6E';
export const COLOR_PRIMARY_LIGHT = '#E6F4F4';
export const COLOR_PRIMARY_DARK = '#084F4F';

export const TEXT_PRIMARY = '#1A1A1A';
export const TEXT_SECONDARY = '#4A4A4A';
export const TEXT_MUTED = '#888888';
export const TEXT_DISABLED = '#BBBBBB';

export const BG_PAGE = '#F7F8FA';
export const BG_CARD = '#FFFFFF';
export const BG_SUBTLE = '#F0F2F5';

export const BORDER_DEFAULT = '#E2E5EA';
export const BORDER_STRONG = '#C8CDD5';

/* ── Status Colors ── */

export const STATUS_CRITICAL = '#DC2626';
export const STATUS_CRITICAL_BG = '#FEF2F2';
export const STATUS_WARNING = '#D97706';
export const STATUS_WARNING_BG = '#FFFBEB';
export const STATUS_INFO = '#2563EB';
export const STATUS_INFO_BG = '#EFF6FF';
export const STATUS_SUCCESS = '#16A34A';
export const STATUS_SUCCESS_BG = '#F0FDF4';
export const STATUS_NOMINAL = '#6B7280';
export const STATUS_NOMINAL_BG = '#F3F4F6';

/* ── Shadows ── */

export const SHADOW_CARD = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)';
export const SHADOW_HOVER = '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)';
export const SHADOW_MODAL = '0 20px 40px rgba(0,0,0,0.12)';

/* ── Radius ── */

export const RADIUS_SM = 4;
export const RADIUS_MD = 8;
export const RADIUS_LG = 12;
export const RADIUS_XL = 16;

/* ── Spacing (4px multiples) ── */

export const SPACING = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

/* ── Type Scale ── */

export const TYPE_SCALE = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 30,
  '3xl': 36,
} as const;

/* ── Sentinel / Federal Level Colors (for charts, SVGs) ── */

export const LEVEL_COLORS = {
  ANOMALY: '#7B1FA2',
  CRITICAL: STATUS_CRITICAL,
  WATCH: STATUS_WARNING,
  ADVISORY: STATUS_NOMINAL,
  NOMINAL: STATUS_SUCCESS,
} as const;

export const CLASSIFICATION_COLORS = {
  likely_attack: STATUS_CRITICAL,
  possible_attack: '#F57C00',
  likely_benign: STATUS_SUCCESS,
  insufficient_data: STATUS_NOMINAL,
} as const;

export const CBRN_COLORS = {
  chemical: '#FF6F00',
  biological: '#2E7D32',
  radiological: '#6A1B9A',
  nuclear: '#B71C1C',
} as const;

export const FPCON_COLORS = {
  NORMAL: STATUS_SUCCESS,
  ALPHA: STATUS_INFO,
  BRAVO: STATUS_WARNING,
  CHARLIE: '#F57C00',
  DELTA: STATUS_CRITICAL,
} as const;

export const FUSION_LEVEL_COLORS = {
  low: STATUS_SUCCESS,
  moderate: STATUS_INFO,
  elevated: STATUS_WARNING,
  high: '#F57C00',
  critical: STATUS_CRITICAL,
} as const;
