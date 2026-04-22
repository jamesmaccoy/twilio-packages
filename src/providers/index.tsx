import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { UserProvider } from '@/context/UserContext'
import { YocoProvider } from './Yoco'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <HeaderThemeProvider>
        <UserProvider>
          <YocoProvider>
            {children}
          </YocoProvider>
        </UserProvider>
      </HeaderThemeProvider>
    </ThemeProvider>
  )
}
