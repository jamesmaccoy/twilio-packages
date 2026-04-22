// storage-adapter-import-placeholder
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { s3Storage } from '@payloadcms/storage-s3'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'

import sharp from 'sharp' // sharp-import
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'
import { Booking } from './collections/Bookings'
import { Estimate } from './collections/Estimates'
import Packages from './collections/Packages'
import { AuthRequests } from './collections/AuthRequests'
import { YocoTransactions } from './collections/YocoTransactions'
import { handleSubscriptionEvent } from './jobs/tasks/handleSubscriptionEvent'
import { subscriptionDowngradeCheck } from './jobs/tasks/subscriptionDowngradeCheck'
import { requeueFailedSubscriptions } from './jobs/tasks/requeueFailedSubscriptions'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
//import analyticsRouter from '@/app/api/analytics/route'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    access: ({ req: { user } }) => {
      if (!user) return false
      const role = user.role
      const roleArray = Array.isArray(role) ? role : role ? [role] : []
      // Only allow admins and hosts to access the admin panel
      return roleArray.includes('admin') || roleArray.includes('host')
    },
    components: {
      afterDashboard: ['@/components/AnalyticsDashboardData/AnalyticsDashboard'],
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below and the import `BeforeLogin` statement on line 15.
      //beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below and the import `BeforeDashboard` statement on line 15.
      //beforeDashboard: ['@/components/BeforeDashboard'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    navigation: [
      {
        label: 'Dashboard',
        path: '/',
      },
      {
        label: 'Collections',
        path: '/collections',
      },
      {
        label: 'Globals',
        path: '/globals',
      },
      {
        label: 'Job Queue',
        path: '/jobs',
      },
    ],
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),
  email: process.env.SMTP_HOST
    ? nodemailerAdapter({
        defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || 'info@simpleplek.co.za',
        defaultFromName: process.env.EMAIL_FROM_NAME || 'Betaplek',
        transportOptions: {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        },
      })
    : nodemailerAdapter(),
  collections: [Booking, Estimate, Pages, Posts, Media, Categories, Users, Packages, AuthRequests, YocoTransactions],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, Footer],
  plugins: [
    ...plugins,
    s3Storage({
      bucket: process.env.R2_BUCKET || '',
      config: {
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
        region: process.env.R2_REGION || '',
        endpoint: process.env.R2_ENDPOINT, // Optional: for S3-compatible storage like Cloudflare R2
        forcePathStyle: true, // Optional: often needed for S3-compatible storage
      },
      collections: {
        media: true,
      },
    }),
    mcpPlugin({
      collections: {
        packages: {
          description: 'Property packages for hosts to manage pricing tiers, availability, and booking options',
          enabled: {
            create: true,
            delete: true,
            find: true,
            update: true,
          },
        },
      },
      mcp: {
        handlerOptions: {
          verboseLogs: process.env.NODE_ENV === 'development',
        },
      },
    }),
  ],
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        if (req.user) return true
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${process.env.CRON_SECRET}`
      },
    },
    tasks: [
      {
        slug: 'handleSubscriptionEvent',
        handler: handleSubscriptionEvent,
        retries: 3,
        inputSchema: [
          { name: 'event', type: 'text', required: true },
          { name: 'userId', type: 'text', required: true },
          { name: 'transactionId', type: 'text' },
          { name: 'plan', type: 'text' },
          { name: 'entitlement', type: 'text' },
          { name: 'expiresAt', type: 'text' },
        ],
        queue: 'subscription-events',
      },
      {
        slug: 'subscriptionDowngradeCheck',
        handler: subscriptionDowngradeCheck,
        schedule: {
          cron: '0 3 * * *',
          queue: 'nightly-cron',
        },
      },
      {
        slug: 'requeueFailedSubscriptions',
        handler: requeueFailedSubscriptions,
        schedule: {
          cron: '*/30 * * * *',
          queue: 'subscription-maintenance',
        },
      },
    ],
    autoRun: [
      {
        queue: 'nightly-cron',
        limit: 100,
      },
      {
        queue: 'subscription-maintenance',
        limit: 25,
      },
    ],
  },
})
