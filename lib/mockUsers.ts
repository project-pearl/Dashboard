// lib/mockUsers.ts
// Demo user accounts for the login page quick-access cards.
// Must stay in sync with authContext seed accounts.

export const DEMO_PASSWORD = 'pearl2025';

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: string;
  state: string;
  organization: string;
}

export const MOCK_USERS: MockUser[] = [
  // Primary role demos (one per role — shown as cards)
  { id: 'demo-federal',     email: 'demo-federal@pearl.gov',       name: 'Federal Demo',           role: 'Federal',    state: 'DC', organization: 'EPA Region 3' },
  { id: 'demo-state-md',    email: 'demo-state@pearl.gov',         name: 'State Demo (MD)',        role: 'State',      state: 'MD', organization: 'MDE' },
  { id: 'demo-ms4-md',      email: 'demo-ms4@pearl.gov',           name: 'MS4 Demo (MD)',          role: 'MS4',        state: 'MD', organization: 'Anne Arundel County DPW' },
  { id: 'demo-corporate',   email: 'demo-corporate@pearl.io',      name: 'Corporate Demo',         role: 'Corporate',  state: 'MD', organization: 'Chesapeake Utilities' },
  { id: 'demo-researcher',  email: 'demo-researcher@pearl.edu',    name: 'Researcher Demo',        role: 'Researcher', state: 'MD', organization: 'UMCES' },
  { id: 'demo-college',     email: 'demo-college@pearl.edu',       name: 'College Demo',           role: 'College',    state: 'MD', organization: 'Towson University' },
  { id: 'demo-ngo',         email: 'demo-ngo@pearl.org',           name: 'NGO Demo',               role: 'NGO',        state: 'MD', organization: 'Chesapeake Bay Foundation' },
  { id: 'demo-k12',         email: 'demo-k12@pearl.org',           name: 'K12 Demo',               role: 'K12',        state: 'MD', organization: 'AACPS' },
  { id: 'demo-public',      email: 'demo-public@pearl.org',        name: 'Public Demo',            role: 'Public',     state: 'MD', organization: 'Community Member' },
  // Additional location variants (shown in "Additional Locations" section)
  { id: 'demo-state-va',    email: 'demo-state-va@pearl.gov',      name: 'State Demo (VA)',        role: 'State',      state: 'VA', organization: 'DEQ Virginia' },
  { id: 'demo-state-fl',    email: 'demo-state-fl@pearl.gov',      name: 'State Demo (FL)',        role: 'State',      state: 'FL', organization: 'FDEP' },
  { id: 'demo-state-pa',    email: 'demo-state-pa@pearl.gov',      name: 'State Demo (PA)',        role: 'State',      state: 'PA', organization: 'PA DEP' },
  { id: 'demo-ms4-balt',    email: 'demo-ms4-balt@pearl.gov',      name: 'MS4 Demo (Baltimore)',   role: 'MS4',        state: 'MD', organization: 'Baltimore County DPW' },
  { id: 'demo-ms4-norfolk', email: 'demo-ms4-norfolk@pearl.gov',   name: 'MS4 Demo (Norfolk)',     role: 'MS4',        state: 'VA', organization: 'City of Norfolk' },
];
