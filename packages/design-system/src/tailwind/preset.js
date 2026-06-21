/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        bg: {
          app: 'var(--color-bg-app)',
          surface: 'var(--color-bg-surface)',
          elevated: 'var(--color-bg-surface-elevated)',
          muted: 'var(--color-bg-surface-muted)',
          'accent-subtle': 'var(--color-bg-accent-subtle)',
        },
        action: {
          primary: 'var(--color-action-primary)',
          'primary-hover': 'var(--color-action-primary-hover)',
          'primary-subtle': 'var(--color-action-primary-subtle)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
        },
        surface: {
          DEFAULT: 'var(--color-bg-surface)',
          subtle: 'var(--color-bg-app)',
          muted: 'var(--color-bg-surface-muted)',
        },
        border: {
          DEFAULT: 'var(--color-border-default)',
          strong: 'var(--color-border-strong)',
          focus: 'var(--color-border-focus)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          'on-primary': 'var(--color-text-on-primary)',
          accent: 'var(--color-text-accent)',
        },
        feedback: {
          success: 'var(--color-feedback-success)',
          'success-subtle': 'var(--color-feedback-success-subtle)',
          error: 'var(--color-feedback-error)',
          'error-subtle': 'var(--color-feedback-error-subtle)',
          warning: 'var(--color-feedback-warning)',
          'warning-subtle': 'var(--color-feedback-warning-subtle)',
          info: 'var(--color-feedback-info)',
          'info-subtle': 'var(--color-feedback-info-subtle)',
        },
        section: {
          brand: {
            fg: 'var(--color-section-brand-fg)',
            subtle: 'var(--color-section-brand-subtle)',
            border: 'var(--color-section-brand-border)',
            muted: 'var(--color-section-brand-muted)',
          },
          plans: {
            fg: 'var(--color-section-plans-fg)',
            subtle: 'var(--color-section-plans-subtle)',
            border: 'var(--color-section-plans-border)',
            muted: 'var(--color-section-plans-muted)',
          },
          academies: {
            fg: 'var(--color-section-academies-fg)',
            subtle: 'var(--color-section-academies-subtle)',
            border: 'var(--color-section-academies-border)',
            muted: 'var(--color-section-academies-muted)',
          },
          users: {
            fg: 'var(--color-section-users-fg)',
            subtle: 'var(--color-section-users-subtle)',
            border: 'var(--color-section-users-border)',
            muted: 'var(--color-section-users-muted)',
          },
          billing: {
            fg: 'var(--color-section-billing-fg)',
            subtle: 'var(--color-section-billing-subtle)',
            border: 'var(--color-section-billing-border)',
            muted: 'var(--color-section-billing-muted)',
          },
          'super-admins': {
            fg: 'var(--color-section-super-admins-fg)',
            subtle: 'var(--color-section-super-admins-subtle)',
            border: 'var(--color-section-super-admins-border)',
            muted: 'var(--color-section-super-admins-muted)',
          },
          audit: {
            fg: 'var(--color-section-audit-fg)',
            subtle: 'var(--color-section-audit-subtle)',
            border: 'var(--color-section-audit-border)',
            muted: 'var(--color-section-audit-muted)',
          },
          matches: {
            fg: 'var(--color-section-matches-fg)',
            subtle: 'var(--color-section-matches-subtle)',
            border: 'var(--color-section-matches-border)',
            muted: 'var(--color-section-matches-muted)',
          },
        },
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        12: 'var(--space-12)',
        16: 'var(--space-16)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        card: 'var(--shadow-elevation-card)',
        brand: 'var(--shadow-elevation-brand)',
        focus: 'var(--shadow-focus-ring)',
      },
      backgroundImage: {
        'brand-gradient': 'var(--gradient-brand)',
        'brand-gradient-subtle': 'var(--gradient-brand-subtle)',
        'brand-gradient-radial': 'var(--gradient-brand-radial)',
      },
      fontSize: {
        xs: ['var(--font-size-xs)', { lineHeight: 'var(--line-height-normal)' }],
        sm: ['var(--font-size-sm)', { lineHeight: 'var(--line-height-normal)' }],
        base: ['var(--font-size-base)', { lineHeight: 'var(--line-height-normal)' }],
        lg: ['var(--font-size-lg)', { lineHeight: 'var(--line-height-tight)' }],
        xl: ['var(--font-size-xl)', { lineHeight: 'var(--line-height-tight)' }],
        '2xl': ['var(--font-size-2xl)', { lineHeight: 'var(--line-height-tight)' }],
        '3xl': ['var(--font-size-3xl)', { lineHeight: 'var(--line-height-tight)' }],
        '4xl': ['var(--font-size-4xl)', { lineHeight: 'var(--line-height-tight)' }],
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
      transitionDuration: {
        fast: 'var(--motion-duration-fast)',
        normal: 'var(--motion-duration-normal)',
        slow: 'var(--motion-duration-slow)',
      },
      transitionTimingFunction: {
        DEFAULT: 'var(--motion-ease)',
      },
    },
  },
  plugins: [],
};
