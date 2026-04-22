import { CollectionAfterReadHook } from 'payload'

export const removeAuthRequest: CollectionAfterReadHook = async ({ doc, req }) => {
  if (!doc) return

  // Remove the auth request from the database
  req.payload.delete({
    collection: 'authRequests',
    id: doc.id,
  })

  return doc
}
