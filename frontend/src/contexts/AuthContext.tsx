import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { useMutation } from '@apollo/client';

import { apolloClient } from '../lib/apolloClient';
import {
  clearToken,
  getToken,
  saveUser,
  setToken,
} from '../lib/auth';
import {
  LOGIN as LOGIN_MUTATION,
  ME,
} from '../lib/queries';

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loginMutation] = useMutation(LOGIN_MUTATION);

  const fetchMe = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setMe(null)
      setLoading(false)
      return
    }

    // Token ada, validasi user via ME
    const { data } = await apolloClient.query({
      query: ME,
      fetchPolicy: 'network-only',
    })

    if (data?.me) {
      setMe(data.me)
      saveUser(data.me)
    } else {
      setMe(null)
      clearToken()
    }
    setLoading(false)
  }, [])

  // On mount, verify token & fetch user
  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  const login = useCallback(async (username, password) => {
    const { data } = await loginMutation({ variables: { username, password } });
    setToken(data.login.token)
    saveUser(data.login.user)
    setMe(data.login.user)
    return data.login.user
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setMe(null)
  }, [])

  const refreshMe = useCallback(async () => {
    await fetchMe()
  }, [fetchMe])


  const isLoggedIn = !!me

  return (
    <AuthContext.Provider value={{ me, isLoggedIn, login, logout, loading, refreshMe }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
