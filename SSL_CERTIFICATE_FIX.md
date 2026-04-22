# SSL Certificate Fix Guide

## Current Issue

**Error**: `ERR_CERT_AUTHORITY_INVALID` on `www.simpleplek.co.za`

**DNS Status**: ✅ DNS records are correct (A records pointing to IPs)

## Root Cause

The SSL certificate is either:
1. Not issued for your domain yet
2. Not properly configured on your hosting provider
3. DNS hasn't fully propagated (certificate can't validate domain ownership)

## Solution Steps

### Step 1: Verify DNS Propagation

Check if DNS has fully propagated:

1. **Use DNS checker tools**:
   - [whatsmydns.net](https://www.whatsmydns.net/#A/simpleplek.co.za)
   - [dnschecker.org](https://dnschecker.org/#A/simpleplek.co.za)

2. **Check from command line**:
   ```bash
   nslookup simpleplek.co.za
   nslookup www.simpleplek.co.za
   ```

3. **Expected**: Both should return your IP addresses (`136.110.143.166` and/or `76.76.21.21`)

### Step 2: Identify Your Hosting Provider

Based on your IP addresses:
- `76.76.21.21` = **Vercel** (common Vercel IP)
- `136.110.143.166` = Check what this is (might be another provider or load balancer)

**If using Vercel:**

1. **Go to Vercel Dashboard** → Your Project → Settings → Domains
2. **Add/Verify Domain**: 
   - Add `simpleplek.co.za`
   - Add `www.simpleplek.co.za`
3. **Vercel will automatically**:
   - Issue SSL certificate (Let's Encrypt)
   - Configure DNS (if you use Vercel DNS)
   - Wait 24-48 hours for certificate provisioning

### Step 3: Fix www CNAME (Important!)

Your current DNS:
```
CNAME  www  →  simpleplek.co.za.
```

**Problem**: This creates a dependency chain that can cause SSL issues.

**Solution**: Point www directly to your hosting provider:

**If Vercel:**
```
CNAME  www  →  cname.vercel-dns.com
```

**If Other Hosting:**
- Check your hosting provider's documentation
- They should provide a CNAME target for www subdomain
- Common examples:
  - `www.yourhost.com`
  - `cname.yourhost.com`
  - Or use an A record instead

### Step 4: Request SSL Certificate

**If Vercel:**
- SSL is automatic once domain is added
- Go to: Project → Settings → Domains
- Add domain → Vercel handles SSL automatically
- Wait 24-48 hours for certificate issuance

**If Other Hosting:**
- Check hosting dashboard for SSL/TLS settings
- Request SSL certificate (usually Let's Encrypt)
- May need to verify domain ownership first

### Step 5: Verify SSL Certificate

After 24-48 hours:

1. **Check SSL status**:
   - [SSL Labs](https://www.ssllabs.com/ssltest/analyze.html?d=simpleplek.co.za)
   - Should show valid certificate

2. **Test in browser**:
   - Visit `https://simpleplek.co.za` → Should work
   - Visit `https://www.simpleplek.co.za` → Should work

## Immediate Actions

### 1. Update www CNAME (Do This Now)

Change your DNS:
```
FROM: CNAME  www  →  simpleplek.co.za.
TO:   CNAME  www  →  cname.vercel-dns.com  (if Vercel)
```

**Or** if your hosting provider gives you a different CNAME target, use that.

### 2. Verify Domain in Hosting Dashboard

- **Vercel**: Go to Project → Settings → Domains → Add domain
- **Other**: Check hosting dashboard for domain/SSL settings

### 3. Wait for SSL Certificate

- **Vercel**: Automatic, takes 24-48 hours
- **Other**: May need to manually request, then wait 24-48 hours

## Troubleshooting

### If SSL Still Fails After 48 Hours:

1. **Check DNS Propagation**:
   - Use [whatsmydns.net](https://www.whatsmydns.net/#A/simpleplek.co.za)
   - All locations should show your IPs

2. **Verify Domain in Hosting**:
   - Make sure domain is added in hosting dashboard
   - Check for any verification steps needed

3. **Check Certificate Status**:
   - Vercel: Project → Settings → Domains → Check certificate status
   - Other: Check hosting SSL/TLS dashboard

4. **Try Manual Certificate Renewal**:
   - Some hosts allow manual SSL certificate renewal
   - Try renewing/requesting certificate again

### If www Still Doesn't Work:

**Option A: Use A Record Instead**
```
A      www  136.110.143.166  600 seconds
A      www  76.76.21.21      600 seconds
```

**Option B: Fix CNAME**
```
CNAME  www  cname.vercel-dns.com  (or your hosting provider's CNAME)
```

## Quick Fix Checklist

- [ ] Verify DNS has propagated (use whatsmydns.net)
- [ ] Update www CNAME to point to hosting provider (not to simpleplek.co.za)
- [ ] Add domain in hosting dashboard (Vercel/other)
- [ ] Wait 24-48 hours for SSL certificate
- [ ] Test SSL: Visit https://simpleplek.co.za
- [ ] Test www: Visit https://www.simpleplek.co.za
- [ ] Verify certificate in SSL Labs

## Expected Timeline

- **DNS Propagation**: 1-4 hours (usually faster)
- **SSL Certificate Issuance**: 24-48 hours after domain added
- **Total**: 24-48 hours from when domain is properly configured

## Why This Matters for Meta Pixel

- ✅ **Meta Pixel requires HTTPS** to load properly
- ✅ **SSL errors block pixel** from initializing
- ✅ **Once SSL is fixed**, pixel will work (with cookie consent)

---

**Status**: ⏳ Waiting for SSL certificate issuance
**Action**: Update www CNAME + verify domain in hosting dashboard

