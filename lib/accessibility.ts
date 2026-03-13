/**
 * Accessibility utility functions for consistent ARIA implementation
 */

export interface AriaProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-current'?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false';
  'aria-hidden'?: boolean;
  'aria-live'?: 'polite' | 'assertive' | 'off';
  'aria-busy'?: boolean;
  'aria-required'?: boolean;
  'aria-invalid'?: boolean;
  'aria-controls'?: string;
  role?: string;
  tabIndex?: number;
}

/**
 * Creates ARIA props for interactive cards/panels
 */
export function createCardAria(label: string, interactive: boolean = false): AriaProps {
  return {
    'aria-label': label,
    role: interactive ? 'button' : 'region',
    tabIndex: interactive ? 0 : undefined,
  };
}

/**
 * Creates ARIA props for data visualization components
 */
export function createChartAria(title: string, description?: string): AriaProps {
  const id = `chart-${Math.random().toString(36).substr(2, 9)}`;
  return {
    role: 'img',
    'aria-labelledby': `${id}-title`,
    'aria-describedby': description ? `${id}-desc` : undefined,
  };
}

/**
 * Creates ARIA props for status indicators
 */
export function createStatusAria(status: string, level: 'info' | 'warning' | 'error' | 'success' = 'info'): AriaProps {
  return {
    'aria-label': `Status: ${status}`,
    role: level === 'error' || level === 'warning' ? 'alert' : 'status',
    'aria-live': level === 'error' || level === 'warning' ? 'assertive' : 'polite',
  };
}

/**
 * Creates ARIA props for navigation elements
 */
export function createNavAria(label: string, current?: boolean): AriaProps {
  return {
    'aria-label': label,
    'aria-current': current ? 'page' : undefined,
    role: 'navigation',
  };
}

/**
 * Creates ARIA props for form fields
 */
export function createFormFieldAria(
  label: string,
  required: boolean = false,
  invalid: boolean = false,
  describedBy?: string
): AriaProps {
  return {
    'aria-label': label,
    'aria-required': required,
    'aria-invalid': invalid,
    'aria-describedby': describedBy,
  };
}

/**
 * Creates ARIA props for loading states
 */
export function createLoadingAria(message: string = 'Loading'): AriaProps {
  return {
    'aria-label': message,
    'aria-live': 'polite',
    'aria-busy': true,
    role: 'status',
  };
}

/**
 * Creates ARIA props for expandable sections
 */
export function createExpandableAria(
  label: string,
  expanded: boolean,
  controls?: string
): AriaProps {
  return {
    'aria-label': label,
    'aria-expanded': expanded,
    'aria-controls': controls,
    role: 'button',
    tabIndex: 0,
  };
}

/**
 * Utility to generate unique IDs for ARIA relationships
 */
export function generateId(prefix: string = 'aria'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Screen reader only utility class
 */
export const srOnly = 'sr-only absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0';