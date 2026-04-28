'use client'

import { User } from '@/payload-types'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type UserContextType = {
  currentUser: User | null
  actorUser?: User | null
  isPreview?: boolean
  previewEmail?: string | null
  isLoading: boolean
  handleAuthChange: () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [actorUser, setActorUser] = useState<User | null>(null)
  const [isPreview, setIsPreview] = useState(false)
  const [previewEmail, setPreviewEmail] = useState<string | null>(null)
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
      setActorUser(data?.actorUser || null)
      setIsPreview(Boolean(data?.isPreview))
      setPreviewEmail(typeof data?.previewEmail === 'string' ? data.previewEmail : null)
    } catch (error) {
      console.error('Error fetching current user:', error);
      setCurrentUser(null);
      setActorUser(null)
      setIsPreview(false)
      setPreviewEmail(null)
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

  return (
    <UserContext.Provider value={{ currentUser, actorUser, isPreview, previewEmail, isLoading, handleAuthChange }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUserContext = () => {
  const ctx = useContext(UserContext)

  if (!ctx) {
    throw new Error('useUserContext must be used within a UserProvider')
  }

  return ctx
}
