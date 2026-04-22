import { CollectionConfig } from 'payload'
import { InitiateMagicAuth } from './endpoints/initiate-magic-auth'
import { VerifyCode } from './endpoints/verify-code'
import { InitiateMagicEmail } from '@/collections/AuthRequests/endpoints/initiate-magic-email'
import { VerifyMagicToken } from '@/collections/AuthRequests/endpoints/verify-magic-token'
import { removeAuthRequest } from './hooks/remove-auth-request'

export const AuthRequests: CollectionConfig = {
  slug: 'authRequests', // changed from "auth-requests"
  admin: {
    hidden: true,
  },
  hooks: {
    afterRead: [removeAuthRequest],
  },
  endpoints: [InitiateMagicAuth, InitiateMagicEmail, VerifyCode, VerifyMagicToken],
  fields: [
    {
      name: 'email',
      type: 'email',
      required: false,
      index: true,
    },
    {
      name: 'mobile',
      type: 'text',
      required: false,
    },
    {
      name: 'code',
      type: 'text',
      required: false,
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
    },
  ],
}
