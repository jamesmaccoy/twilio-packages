import { CollectionBeforeValidateHook } from 'payload'

// This hook will add the customer ID to the form if the user is logged in.
// FormIds are the id of forms for which this hook should run.
export const addCustomerToForm =
  (formIds: string[]): CollectionBeforeValidateHook =>
  ({ data, req: { user, payload } }) => {
    if (data && typeof data === 'object' && 'form' in data && formIds.includes(data.form) && user) {
      payload.logger.info(
        `User is logged in, adding customer to form. FormID: ${data.form}, CustomerID: ${user?.id}, SubmissionID: ${data?.id}`,
      )
      data.customer = user?.id
    }

    console.log('customer:', data?.customer ? '[REDACTED]' : 'none')
    return data
  }
