import {
  Tailwind,
  Button,
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Hr,
  Heading,
} from '@react-email/components'

interface PasswordResetEmailProps {
  resetLink?: string
  userName?: string
  expiryTime?: string
}

const PasswordResetEmail = ({
  resetLink = 'https://example.com/reset-password',
  userName = 'User',
  expiryTime = '1 hour',
}: PasswordResetEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Reset your password for your Simpleplek account</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                background: '#ffffff',
                foreground: '#020202',
                card: '#F4F4F4',
                'card-foreground': '#020202',
                primary: '#0F0F0F',
                'primary-foreground': '#F8F8F8',
                border: '#C9C9C9',
              },
            },
          },
        }}
      >
        <Body className="bg-background mx-auto my-auto font-sans">
          <Container
            style={{ maxWidth: '650px' }}
            className="border border-border p-8 rounded-lg my-10 mx-auto bg-card max-w-[650px]"
          >
            <Heading className="text-2xl font-medium text-card-foreground mb-4">
              Reset Your Password
            </Heading>
            <Text className="text-card-foreground text-lg mb-4">
              Hello {userName},
            </Text>
            <Text className="text-card-foreground text-base mb-4">
              We received a request to reset your password. Click the button below to create a new password. This link will expire in {expiryTime}.
            </Text>
            <Section className="text-center mb-4">
              <Button
                href={resetLink}
                className="bg-primary px-6 py-3 rounded font-medium text-white"
              >
                Reset Password
              </Button>
            </Section>
            <Text className="text-card-foreground text-sm mb-4">
              Or copy and paste this link into your browser:
            </Text>
            <Text className="text-xs text-muted-foreground break-all mb-4">
              {resetLink}
            </Text>
            <Hr className="border-border my-6" />
            <Text className="text-xs text-muted-foreground">
              If you didn&apos;t request a password reset, you can safely ignore this email. Your password will not be changed.
            </Text>
            <Text className="text-xs text-muted-foreground mt-2">
              For security reasons, this link expires in {expiryTime}. If you need to reset your password again, please request a new reset link.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export default PasswordResetEmail

