import { FieldAccess } from 'payload'

export const isAdminField: FieldAccess = ({ req: { user } }) => {
  return Boolean(user?.role?.includes('admin'))
}
