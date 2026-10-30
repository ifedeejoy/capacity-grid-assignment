import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'capacity.theme'

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function initialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : systemTheme()
}

/**
 * Light/dark switch. The stylesheet is built on `color-scheme` and system
 * colours, so flipping one attribute on <html> re-themes everything.
 * Starts from the OS preference; an explicit choice is remembered.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === 'dark' ? '☾' : '☀'}
    </button>
  )
}
