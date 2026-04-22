import ForgotPasswordForm from './_components/ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6">Reset Your Password</h1>
        <ForgotPasswordForm />
      </div>
    </div>
  )
}

