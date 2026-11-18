/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-fg': 'rgb(var(--accent-fg) / <alpha-value>)',
        positive: 'rgb(var(--positive) / <alpha-value>)',
        negative: 'rgb(var(--negative) / <alpha-value>)',
        'negative-fg': 'rgb(var(--negative-fg) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        // Hanya didefinisikan untuk tampilan baru: garis bagian & sidebar gelap.
        rule: 'rgb(var(--rule) / <alpha-value>)',
        rail: 'rgb(var(--rail) / <alpha-value>)',
        'rail-fg': 'rgb(var(--rail-fg) / <alpha-value>)',
        'rail-muted': 'rgb(var(--rail-muted) / <alpha-value>)',
        'rail-accent': 'rgb(var(--rail-accent) / <alpha-value>)',
        'rail-line': 'rgb(var(--rail-line) / <alpha-value>)',
      },
      fontFamily: {
        // Inter untuk tampilan lama, Instrument Sans untuk tampilan baru (lihat --font-sans di index.css).
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        card: '0.75rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        pop: '0 4px 12px -2px rgb(0 0 0 / 0.12), 0 2px 6px -2px rgb(0 0 0 / 0.08)',
      },
    },
  },
  plugins: [
    // `touch:` = layar sentuh; dipakai tampilan baru untuk target sentuh 44px.
    // Diawali `html` supaya menang dari `sm:`/`lg:` (media query responsif dicetak setelah varian plugin).
    ({ addVariant }) => addVariant('touch', '@media (pointer: coarse) { html & }'),
  ],
}
