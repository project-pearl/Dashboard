// ─── Shared Jurisdiction & State Constants ──────────────────────────────────
// Single source of truth for AuthForms and UserManagementPanel.

export const MD_JURISDICTIONS: { key: string; label: string; permit: string }[] = [
  { key: 'anne_arundel_county', label: 'Anne Arundel County', permit: 'MDR068144' },
  { key: 'baltimore_county', label: 'Baltimore County', permit: 'MDR068246' },
  { key: 'baltimore_city', label: 'Baltimore City', permit: 'MDR068322' },
  { key: 'howard_county', label: 'Howard County', permit: 'MDR068365' },
  { key: 'montgomery_county', label: 'Montgomery County', permit: 'MDR068399' },
  { key: 'prince_georges_county', label: "Prince George's County", permit: 'MDR068284' },
  { key: 'harford_county', label: 'Harford County', permit: 'MDR068411' },
  { key: 'charles_county', label: 'Charles County', permit: 'MDR068438' },
  { key: 'frederick_county', label: 'Frederick County', permit: 'MDR068446' },
  { key: 'carroll_county', label: 'Carroll County', permit: 'MDR068454' },
  { key: 'cecil_county', label: 'Cecil County', permit: 'MDR068462' },
  { key: 'queen_annes_county', label: "Queen Anne's County", permit: 'MDR068471' },
  { key: 'kent_county', label: 'Kent County', permit: 'MDR068489' },
  { key: 'talbot_county', label: 'Talbot County', permit: 'MDR068497' },
  { key: 'dorchester_county', label: 'Dorchester County', permit: 'MDR068501' },
  { key: 'wicomico_county', label: 'Wicomico County', permit: 'MDR068519' },
  { key: 'washington_county', label: 'Washington County', permit: 'MDR068527' },
  { key: 'calvert_county', label: 'Calvert County', permit: 'MDR068535' },
  { key: 'st_marys_county', label: "St. Mary's County", permit: 'MDR068543' },
];

export const STATES = [
  { abbr: 'MD', name: 'Maryland' }, { abbr: 'VA', name: 'Virginia' }, { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'DC', name: 'Washington DC' }, { abbr: 'NY', name: 'New York' }, { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'DE', name: 'Delaware' },
];

/** Free email domains that should trigger a warning for operator roles */
export const FREE_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'proton.me', 'zoho.com',
  'yandex.com', 'gmx.com', 'live.com', 'msn.com',
];

export function isFreeEmailDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return FREE_EMAIL_DOMAINS.includes(domain);
}
