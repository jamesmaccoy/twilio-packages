# Vercel DNS Configuration Guide

## Current Issue

Vercel is detecting **conflicting DNS records** that need to be removed:
- ❌ A record: `@` → `136.110.143.166` (conflicts with Vercel)
- ❌ AAAA record: `@` → `2600:1901:0:4095::` (conflicts with Vercel)

## What Vercel Wants

Vercel needs you to:
1. **Remove conflicting records** (your current A and AAAA records)
2. **Use Vercel's DNS records** instead (they'll show you the correct ones)

## Steps to Fix

### Step 1: Check Vercel Dashboard for Correct Records

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Domains**
2. Click on `simpleplek.co.za` domain
3. Vercel will show you the **exact DNS records** you need to use
4. They'll look something like:
   ```
   Type: A
   Name: @
   Value: [Vercel's IP address]
   
   Type: AAAA
   Name: @
   Value: [Vercel's IPv6 address]
   
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

### Step 2: Update Your DNS Records

**DELETE these records:**
```
❌ A      @    136.110.143.166
❌ AAAA   @    2600:1901:0:4095::
```

**ADD Vercel's recommended records** (get exact values from Vercel dashboard):
```
✅ A      @    [Vercel's IP address from dashboard]
✅ AAAA   @    [Vercel's IPv6 address from dashboard]
✅ CNAME  www  cname.vercel-dns.com  (or Vercel's recommended value)
```

**KEEP these:**
```
✅ CNAME  _domainconnect  _domainconnect.gd.domaincontrol.com.
```

### Step 3: Update DNS at Your Domain Registrar

1. **Log into your domain registrar** (where you manage simpleplek.co.za)
2. **Go to DNS Management**
3. **Delete conflicting records**:
   - Remove A record: `@` → `136.110.143.166`
   - Remove AAAA record: `@` → `2600:1901:0:4095::`
4. **Add Vercel's records** (from Step 1):
   - Add A record with Vercel's IP
   - Add AAAA record with Vercel's IPv6
   - Update www CNAME to `cname.vercel-dns.com`
5. **Save changes**

### Step 4: Verify in Vercel

1. Go back to **Vercel Dashboard** → **Settings** → **Domains**
2. Vercel will check your DNS records
3. Status should change to **"Valid Configuration"** or **"Connected"**
4. SSL certificate will be issued automatically (24-48 hours)

## Important Notes

### Why Remove Those Records?

- `136.110.143.166` is **not a Vercel IP** - it's conflicting with Vercel's infrastructure
- Vercel needs to control the DNS to:
  - Issue SSL certificates properly
  - Route traffic correctly
  - Provide CDN and edge network benefits

### About the Old Records

Vercel mentioned:
> "The old records of cname.vercel-dns.com and 76.76.21.21 will continue to work but we recommend you use the new ones."

This means:
- `76.76.21.21` might still work, but Vercel prefers you use their **new IP addresses**
- Check Vercel dashboard for the **latest recommended IPs**

## Expected DNS Configuration (After Fix)

```
A      @    [Vercel's new IP address]
AAAA   @    [Vercel's new IPv6 address]
CNAME  www  cname.vercel-dns.com
CNAME  _domainconnect  _domainconnect.gd.domaincontrol.com.
```

## Timeline

- **DNS Update**: 1-4 hours to propagate
- **Vercel Verification**: Usually within minutes after DNS matches
- **SSL Certificate**: 24-48 hours after Vercel verifies domain

## Troubleshooting

### If Vercel Still Shows Errors:

1. **Double-check DNS records** match exactly what Vercel shows
2. **Wait for DNS propagation** (use [whatsmydns.net](https://www.whatsmydns.net))
3. **Check for typos** in IP addresses
4. **Remove ALL conflicting records** (including the old 76.76.21.21 if Vercel says to)

### If SSL Still Doesn't Work:

1. **Verify domain is connected** in Vercel dashboard
2. **Wait 24-48 hours** for SSL certificate issuance
3. **Check Vercel domain status** - should show "Valid Configuration"
4. **Contact Vercel support** if issues persist

## Quick Action Checklist

- [ ] Go to Vercel Dashboard → Settings → Domains
- [ ] Note the exact DNS records Vercel wants you to use
- [ ] Delete A record: `@` → `136.110.143.166`
- [ ] Delete AAAA record: `@` → `2600:1901:0:4095::`
- [ ] Add Vercel's A record (from dashboard)
- [ ] Add Vercel's AAAA record (from dashboard)
- [ ] Update www CNAME to `cname.vercel-dns.com`
- [ ] Wait for DNS propagation (1-4 hours)
- [ ] Verify in Vercel dashboard (should show "Valid Configuration")
- [ ] Wait 24-48 hours for SSL certificate
- [ ] Test: Visit `https://simpleplek.co.za`

---

**Status**: ⚠️ Conflicting DNS records detected by Vercel
**Action**: Remove conflicting records and use Vercel's recommended DNS configuration

