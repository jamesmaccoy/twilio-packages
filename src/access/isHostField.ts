import { FieldAccess } from 'payload'

export const isHostField: FieldAccess = ({ req: { user } }) => {
  return Boolean((user as any)?.role?.includes('host'))
} 