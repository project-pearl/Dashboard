import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
        'fluid-xs': 'clamp(0.625rem, 0.55rem + 0.25vw, 0.75rem)',
        'fluid-sm': 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
        'fluid-base': 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)',
        'fluid-lg': 'clamp(1rem, 0.9rem + 0.5vw, 1.25rem)',
        'fluid-xl': 'clamp(1.125rem, 1rem + 0.6vw, 1.5rem)',
        'fluid-2xl': 'clamp(1.25rem, 1.1rem + 0.75vw, 1.875rem)',
        'fluid-3xl': 'clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem)',
      },
      zIndex: {
        'dropdown': '100',
        'sticky': '200',
        'overlay': '300',
        'modal': '400',
        'popover': '500',
        'toast': '600',
        'tooltip': '700',
        'max': '9999',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        'elevated': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.06)',
        'overlay': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.08)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        /* PIN theme tokens — used in place of inline style={{ color: var(...) }} */
        pin: {
          teal: 'var(--accent-teal)',
          copper: 'var(--pin-copper)',
          'page-bg': 'var(--pin-page-bg)',
          'text-bright': 'var(--text-bright)',
          'text-primary': 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          'text-dim': 'var(--text-dim)',
          'bg-card': 'var(--bg-card)',
          'bg-hover': 'var(--bg-hover)',
          'border-default': 'var(--border-default)',
          'border-subtle': 'var(--border-subtle)',
          'bg-surface': 'var(--bg-surface)',
          'status-healthy': 'var(--status-healthy)',
          'status-healthy-bg': 'var(--status-healthy-bg)',
          'status-warning': 'var(--status-warning)',
          'status-warning-bg': 'var(--status-warning-bg)',
          'status-watch': 'var(--status-watch)',
          'status-watch-bg': 'var(--status-watch-bg)',
          'status-impaired': 'var(--status-impaired)',
          'status-impaired-bg': 'var(--status-impaired-bg)',
          'status-severe': 'var(--status-severe)',
          'status-severe-bg': 'var(--status-severe-bg)',
          'pill-bg': 'var(--pill-bg)',
          'pill-bg-active': 'var(--pill-bg-active)',
          'pill-text': 'var(--pill-text)',
          'pill-text-active': 'var(--pill-text-active)',
          'pill-border': 'var(--pill-border)',
          'pill-border-active': 'var(--pill-border-active)',
          'beta': 'var(--pin-beta)',
          'beta-bg': 'var(--pin-beta-bg)',
          'beta-border': 'var(--pin-beta-border)',
        },
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
