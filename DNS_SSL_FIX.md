# DNS & SSL Certificate Fix Guide

## Problem Identified

Your DNS records have a **circular CNAME reference**:
- `simpleplek.co.za` → `simpleplek.co.za.` ❌ (Invalid - points to itself)

This causes:
- `ERR_CERT_AUTHORITY_INVALID` SSL errors
- DNS resolution failures
- Meta Pixel cannot load (requires HTTPS)

## Root Cause

**Root domains (apex domains) cannot have CNAME records pointing to themselves.** Root domains need:
- **A records** pointing to an IP address, OR
- **CNAME records** pointing to your hosting provider's domain (e.g., Vercel, Cloudflare)

## Solution

### Step 1: Identify Your Hosting Provider

Check where your site is hosted:
- **Vercel?** → Use Vercel's DNS instructions
- **Cloudflare?** → Use Cloudflare DNS
- **Other hosting?** → Check their DNS documentation

### Step 2: Fix DNS Records

#### If Hosted on Vercel:

1. **Go to Vercel Dashboard** → Your Project → Settings → Domains
2. **Add Domain**: `simpleplek.co.za`
3. **Vercel will show you the correct DNS records** - they'll look like:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21 (or similar Vercel IP)
   
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com (or similar)
   ```

#### If Hosted Elsewhere:

**Option A: Use A Records (Recommended for root domain)**
```
Type: A
Name: @ (or simpleplek.co.za)
Value: [Your hosting provider's IP address]
TTL: 1 Hour

Type: CNAME
Name: www
Value: simpleplek.co.za. (or your hosting provider's domain)
TTL: 1 Hour
```

**Option B: Use CNAME Flattening (if supported by your DNS provider)**
Some DNS providers (like Cloudflare) support CNAME flattening, which allows CNAME records on root domains:
```
Type: CNAME
Name: @ (or simpleplek.co.za)
Value: [Your hosting provider's domain]
TTL: 1 Hour
```

### Step 3: Current DNS Records to Fix

**DELETE these incorrect records:**
```
❌ CNAME  simpleplek.co.za  →  simpleplek.co.za.
```

**KEEP this record (but verify it's correct):**
```
✅ CNAME  www  →  simpleplek.co.za.  (or your hosting provider's domain)
```

**ADD these records (replace with your hosting provider's values):**
```
✅ A      @ (or simpleplek.co.za)  →  [Hosting Provider IP]
✅ CNAME  www  →  [Hosting Provider Domain] (if not already correct)
```

### Step 4: Update DNS at Your Domain Registrar

1. **Log into your domain registrar** (where you bought simpleplek.co.za)
2. **Go to DNS Management** or **DNS Settings**
3. **Delete the circular CNAME**: `simpleplek.co.za → simpleplek.co.za.`
4. **Add correct A record** pointing to your hosting provider's IP
5. **Update www CNAME** to point to your hosting provider (not to simpleplek.co.za)

### Step 5: Wait for DNS Propagation

- DNS changes can take **1-48 hours** to propagate
- Use [whatsmydns.net](https://www.whatsmydns.net) to check propagation
- Check: `dig simpleplek.co.za` or `nslookup simpleplek.co.za`

### Step 6: SSL Certificate

Once DNS is fixed:
- **Vercel**: SSL certificates are automatically provisioned
- **Cloudflare**: SSL is automatic with Cloudflare proxy enabled
- **Other hosts**: May need to request/renew SSL certificate

## Quick Fix Checklist

- [ ] Identify hosting provider (Vercel/Cloudflare/Other)
- [ ] Get correct DNS records from hosting provider
- [ ] Delete circular CNAME: `simpleplek.co.za → simpleplek.co.za.`
- [ ] Add A record for root domain pointing to hosting IP
- [ ] Update www CNAME to point to hosting provider
- [ ] Wait for DNS propagation (check with whatsmydns.net)
- [ ] Verify SSL certificate is valid
- [ ] Test Meta Pixel loads correctly

## Testing After Fix

1. **Check DNS**: `nslookup simpleplek.co.za` should return an IP address (not itself)
2. **Check SSL**: Visit `https://simpleplek.co.za` - should show valid certificate
3. **Check Meta Pixel**: Browser console should show "Meta Pixel initialized"
4. **Test HTTPS**: No more `ERR_CERT_AUTHORITY_INVALID` errors

## Common Hosting Providers

### Vercel
- **A Record**: `76.76.21.21` (or check Vercel dashboard)
- **CNAME**: `cname.vercel-dns.com` (or check Vercel dashboard)
- **SSL**: Automatic

### Cloudflare
- Enable **Proxy** (orange cloud) for automatic SSL
- **A Record**: Your origin server IP
- **CNAME**: Can use CNAME flattening for root domain
- **SSL**: Automatic with proxy enabled

### Other Providers
- Check your hosting provider's DNS documentation
- They should provide specific IP addresses or CNAME targets

## Need Help?

1. **Check hosting provider docs** for DNS setup
2. **Contact hosting support** if unsure about DNS records
3. **Use DNS checker tools**:
   - [whatsmydns.net](https://www.whatsmydns.net)
   - [dnschecker.org](https://dnschecker.org)

## Impact on Meta Pixel

Once DNS and SSL are fixed:
- ✅ HTTPS will work properly
- ✅ Meta Pixel will load from `https://connect.facebook.net`
- ✅ Browser won't block pixel due to SSL errors
- ✅ Events will start tracking correctly

---

**Important**: DNS changes can take up to 48 hours to fully propagate. Be patient and verify changes are live before testing.

