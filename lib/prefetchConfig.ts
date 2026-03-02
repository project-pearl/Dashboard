/**
 * Prefetch Configuration — Maps role → data sources to pre-warm on login.
 *
 * Each entry lists the cache sources and scope strategy for a given user role.
 * 'allPriority' = warm all PRIORITY_STATES, 'userState' = warm only user's state.
 */

import type { UserRole } from './authTypes';

export interface PrefetchSource {
  source: string;
  scope: 'allPriority' | 'userState';
}

export const PREFETCH_CONFIG: Partial<Record<UserRole, PrefetchSource[]>> = {
  Federal: [
    { source: 'icis', scope: 'allPriority' },
    { source: 'sdwis', scope: 'allPriority' },
    { source: 'echo', scope: 'allPriority' },
    { source: 'attains', scope: 'allPriority' },
    { source: 'stateReport', scope: 'allPriority' },
    { source: 'nwsAlerts', scope: 'allPriority' },
  ],
  State: [
    { source: 'icis', scope: 'userState' },
    { source: 'sdwis', scope: 'userState' },
    { source: 'echo', scope: 'userState' },
    { source: 'nwis-gw', scope: 'userState' },
    { source: 'wqp', scope: 'userState' },
    { source: 'stateReport', scope: 'userState' },
  ],
  MS4: [
    { source: 'icis', scope: 'userState' },
    { source: 'sdwis', scope: 'userState' },
    { source: 'nwis-gw', scope: 'userState' },
  ],
  Utility: [
    { source: 'icis', scope: 'userState' },
    { source: 'sdwis', scope: 'userState' },
    { source: 'echo', scope: 'userState' },
  ],
  Corporate: [
    { source: 'echo', scope: 'allPriority' },
    { source: 'icis', scope: 'allPriority' },
  ],
  Investor: [
    { source: 'echo', scope: 'allPriority' },
    { source: 'icis', scope: 'allPriority' },
  ],
  Biotech: [
    { source: 'echo', scope: 'allPriority' },
    { source: 'icis', scope: 'allPriority' },
  ],
  Local: [
    { source: 'nwis-gw', scope: 'userState' },
    { source: 'wqp', scope: 'userState' },
    { source: 'sdwis', scope: 'userState' },
  ],
  K12: [
    { source: 'nwis-gw', scope: 'userState' },
    { source: 'wqp', scope: 'userState' },
  ],
};
