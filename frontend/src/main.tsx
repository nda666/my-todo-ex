import './index.css';

import { StrictMode } from 'react';

import {
  ConfigProvider,
  theme,
} from 'antd';
import { createRoot } from 'react-dom/client';

import { ApolloProvider } from '@apollo/client';

import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext';
import {
  ThemeProvider,
  useTheme,
} from './contexts/ThemeContext';
import {
  apolloClient,
  initPersistedCache,
} from './lib/apolloClient';

function AppWithAntdTheme() {
  const { resolvedTheme } = useTheme()

  return (
    <>
      <ConfigProvider
        theme={{
          algorithm: resolvedTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: '#3b82f6',
            borderRadius: 8,
            fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
          },
        }}
      >
        <ApolloProvider client={apolloClient}>
          <AuthProvider>

            <App />
          </AuthProvider>
        </ApolloProvider>
      </ConfigProvider>
    </>
  )
}

initPersistedCache().then(() => {
  createRoot(document.getElementById('root')).render(
    <>
      <StrictMode>

        <ThemeProvider  >
          <AppWithAntdTheme />
        </ThemeProvider >
      </StrictMode></>,
  )
});