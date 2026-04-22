# Resend SMTP Configuration

This project uses Resend SMTP for sending email notifications. The configuration is handled through environment variables.

## Environment Variables Required

Add these environment variables to your `.env.local` file:

```bash
# Resend SMTP Configuration
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=your_resend_api_key_here
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME=Betaplek
ADMIN_NOTIFICATION_EMAIL=info@yourdomain.com
```

## Resend Setup

1. **Create a Resend Account**: Sign up at [resend.com](https://resend.com)

2. **Get Your API Key**: 
   - Go to your Resend dashboard
   - Navigate to API Keys section
   - Create a new API key
   - Copy the API key (this will be your `SMTP_PASS`)

3. **Verify Your Domain** (Optional but recommended):
   - Add your domain in the Resend dashboard
   - Follow the DNS verification steps
   - This allows you to send emails from your own domain

4. **Configure Environment Variables**:
   - Set `SMTP_PASS` to your Resend API key
   - Set `EMAIL_FROM_ADDRESS` to your verified domain email
   - Set `EMAIL_FROM_NAME` to your preferred sender name
   - Set `ADMIN_NOTIFICATION_EMAIL` to the administrator inbox that should receive package activity confirmations (create/update/delete)

## Email Features

The system sends the following types of emails:

### Estimate Request Notifications
- **Triggered**: When a customer requests a new estimate for different dates
- **Recipients**: Property hosts/owners
- **Content**: Property details, requested dates, customer information
- **Template**: Professional HTML email with fallback text version

## Email Templates

The email templates are located in `src/lib/emailNotifications.ts` and include:

- **HTML Version**: Professional responsive design with modern styling
- **Text Version**: Plain text fallback for email clients that don't support HTML
- **Responsive Design**: Works on desktop and mobile devices
- **Branding**: Consistent with Betaplek branding

## Testing

To test email functionality:

1. Ensure all environment variables are set correctly
2. Make a test estimate request through the booking page
3. Check the console logs for email sending status
4. Verify the email is received in the host's inbox

## Troubleshooting

### Common Issues:

1. **"Authentication failed"**: Check your Resend API key
2. **"Connection timeout"**: Verify SMTP_HOST and SMTP_PORT settings
3. **"From address not verified"**: Ensure your domain is verified in Resend
4. **Emails not received**: Check spam folder, verify recipient email address

### Debug Mode:

The system logs detailed information about email sending:
- Email recipient and sender
- Email content preview
- Success/failure status
- Error messages if sending fails

## Production Considerations

1. **Rate Limits**: Resend has rate limits based on your plan
2. **Domain Reputation**: Use a verified domain for better deliverability
3. **Monitoring**: Set up monitoring for failed email sends
4. **Backup**: Consider implementing a backup email service for critical notifications

## Security

- Never commit API keys to version control
- Use environment variables for all sensitive configuration
- Regularly rotate API keys
- Monitor email sending logs for suspicious activity
