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

interface MagicAuthEmailProps {
  magicLink?: string
  userName?: string
  expiryTime?: string
  code?: string
}

const MagicAuthEmail = ({
  magicLink = 'https://example.com/auth/login',
  userName = 'User',
  expiryTime = '15 minutes',
  code = '542316',
}: MagicAuthEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{code} is your login code for accessing your account on Simpleplek</Preview>
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
              Welcome, {userName}
            </Heading>
            <Text className="text-card-foreground text-lg mb-4">
              Use the button below to securely log in to your account. This link will expire in{' '}
              {expiryTime}.
            </Text>
            <Section className="text-center mb-4">
              <Button
                href={magicLink}
                className="bg-primary px-6 py-3 rounded font-medium text-white"
              >
                Log in to your account
              </Button>
            </Section>
            <Text className="text-card-foreground text-base mb-4 text-center font-medium">
              You can also copy and paste this code to sign in.
            </Text>
            <Container className="bg-primary/10 rounded-md">
              <Text className="text-5xl tracking-widest font-mono text-foreground text-center">
                {code}
              </Text>
            </Container>
            <Hr className="border-border my-6" />
            <Text className="text-xs text-muted-foreground">
              This link was sent to you because someone (hopefully you) requested to log in to your
              account. If you didn&apos;t request this link, you can safely ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export default MagicAuthEmail
