import React, { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState(() => {
    return localStorage.getItem('doran_todo_theme') || 'default'
  })
  const [resolvedTheme, setResolvedTheme] = useState('dark') // 'light' | 'dark'

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleThemeChange = () => {
      let activeTheme = 'dark'
      if (themeMode === 'light') {
        activeTheme = 'light'
      } else if (themeMode === 'dark') {
        activeTheme = 'dark'
      } else {
        // 'default' (system preference)
        activeTheme = mediaQuery.matches ? 'dark' : 'light'
      }

      setResolvedTheme(activeTheme)

      const root = document.documentElement
      if (activeTheme === 'dark') {
        root.classList.add('dark')
        root.style.colorScheme = 'dark'
      } else {
        root.classList.remove('dark')
        root.style.colorScheme = 'light'
      }
    }

    handleThemeChange()

    // Listen for system theme changes if 'default' is active
    if (themeMode === 'default') {
      mediaQuery.addEventListener('change', handleThemeChange)
    }

    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange)
    }
  }, [themeMode])

  const setThemeMode = (mode) => {
    localStorage.setItem('doran_todo_theme', mode)
    setThemeModeState(mode)
  }

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
