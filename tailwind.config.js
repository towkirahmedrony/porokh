/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'app': 'var(--bg-app)',
        'surface': 'var(--bg-surface)',
        'surface-elevated': 'var(--bg-surface-elevated)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'border-color': 'var(--border-color)',
        'input-bg': 'var(--input-bg)',
        'input-border': 'var(--input-border)',
        'primary': 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        'secondary': 'var(--secondary)',
        'accent': 'var(--accent)',
        'success': 'var(--success)',
        'warning': 'var(--warning)',
        'danger': 'var(--danger)',
        'info': 'var(--info)',
        'nav-bg': 'var(--nav-bg)',
        'nav-text': 'var(--nav-text)',
        'card-bg': 'var(--card-bg)',
        'card-border': 'var(--card-border)',
        'badge-bg': 'var(--badge-bg)',
        'badge-text': 'var(--badge-text)',
        'focus-ring': 'var(--focus-ring)',
      },
      fontFamily: {
        sans: ['Inter', 'Hind Siliguri', 'sans-serif'],
        bengali: ['Noto Sans Bengali', 'Hind Siliguri', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
