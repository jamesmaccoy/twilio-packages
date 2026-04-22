'use client'

import { User } from '@/payload-types'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type UserContextType = {
  currentUser: User | null
  isLoading: boolean
  handleAuthChange: () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchCurrentUser = useCallback(async () => {
    setIsLoading(true)
    try {
      const req = await fetch(`/api/users/me`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const data = await req.json()
      setCurrentUser(data?.user || null)
    } catch (error) {
      console.error('Error fetching current user:', error);
      setCurrentUser(null);
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCurrentUser()
  }, [fetchCurrentUser])

  const handleAuthChange = () => {
    fetchCurrentUser()
  }

  return <UserContext.Provider value={{ currentUser, isLoading, handleAuthChange }}>{children}</UserContext.Provider>
}

export const useUserContext = () => {
  const ctx = useContext(UserContext)

  if (!ctx) {
    throw new Error('useUserContext must be used within a UserProvider')
  }

  return ctx
}
