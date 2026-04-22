# DNS Status Check - Current Configuration

## Current DNS Records ✅

```
A      @    136.110.143.166  600 seconds
A      @    76.76.21.21      600 seconds
CNAME  www  simpleplek.co.za.  1 Hour
CNAME  _domainconnect  _domainconnect.gd.domaincontrol.com.
```

## Analysis

### ✅ Good:
1. **Circular CNAME deleted** - This was the main issue!
2. **A records added** - Root domain now points to IP addresses
3. **Multiple A records** - This is fine (load balancing/failover)

### ⚠️ Potential Issues:

1. **www CNAME still points to simpleplek.co.za.**
   - This might work now that simpleplek.co.za resolves to an IP
   - But it's better to point www directly to your hosting provider
   - If you're on Vercel, www should point to `cname.vercel-dns.com` or similar

2. **Two different IP addresses**
   - `136.110.143.166` - Check if this is your hosting provider
   - `76.76.21.21` - This is a common Vercel IP
   - Both should point to the same hosting provider

## What to Check Now

### 1. Verify DNS Propagation
Run these commands to check if DNS is resolving:

```bash
# Check root domain
nslookup simpleplek.co.za

# Check www subdomain
nslookup www.simpleplek.co.za

# Or use online tools:
# https://www.whatsmydns.net/#A/simpleplek.co.za
# https://dnschecker.org/#A/simpleplek.co.za
```

**Expected results:**
- `simpleplek.co.za` should return: `136.110.143.166` and/or `76.76.21.21`
- `www.simpleplek.co.za` should resolve (either to same IPs or via CNAME)

### 2. Test SSL Certificate
After DNS propagates (can take 1-48 hours):

1. Visit: `https://simpleplek.co.za`
2. Check if SSL certificate is valid (no more `ERR_CERT_AUTHORITY_INVALID`)
3. Visit: `https://www.simpleplek.co.za`
4. Both should work with valid SSL

### 3. Test Meta Pixel
Once SSL is working:

1. Open browser console on your site
2. Look for: `Meta Pixel initialized: 2659582847593179`
3. Install [Facebook Pixel Helper](https://chrome.google.com/webstore/detail/facebook-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc)
4. Check if pixel fires PageView event

## Next Steps

### Immediate (while waiting for DNS):
- ✅ DNS records are updated
- ⏳ Wait for DNS propagation (check with whatsmydns.net)
- ⏳ SSL certificate should auto-renew once DNS is correct

### After DNS Propagates (1-48 hours):
1. **Test HTTPS**: Visit `https://simpleplek.co.za` - should work
2. **Test www**: Visit `https://www.simpleplek.co.za` - should work
3. **Check SSL**: Certificate should be valid
4. **Test Meta Pixel**: Should load without errors

### Optional Improvements:

**If www CNAME causes issues**, update it to point directly to your hosting provider:
- **Vercel**: `www` → `cname.vercel-dns.com`
- **Other hosts**: Check their documentation for www CNAME target

## Monitoring

### Check DNS Propagation Status:
- [whatsmydns.net](https://www.whatsmydns.net/#A/simpleplek.co.za) - See global DNS propagation
- [dnschecker.org](https://dnschecker.org/#A/simpleplek.co.za) - Check DNS from multiple locations

### Check SSL Certificate:
- [SSL Labs](https://www.ssllabs.com/ssltest/analyze.html?d=simpleplek.co.za) - Test SSL configuration
- Browser: Visit site and check certificate details

### Check Meta Pixel:
- Browser console: Look for pixel initialization
- Facebook Pixel Helper extension: Verify events firing
- Meta Events Manager: Check Test Events tab

## Timeline

- **DNS Propagation**: 1-48 hours (usually faster, 1-4 hours)
- **SSL Certificate**: Should auto-renew once DNS is correct (may take a few hours)
- **Meta Pixel**: Will work immediately once SSL is valid

## Troubleshooting

### If SSL still shows errors after 24 hours:
1. Check DNS is fully propagated (use whatsmydns.net)
2. Verify A records point to correct hosting provider
3. Check hosting provider's SSL certificate status
4. May need to manually renew SSL certificate in hosting dashboard

### If www subdomain doesn't work:
- Update www CNAME to point directly to hosting provider (not to simpleplek.co.za.)
- Or add A record for www pointing to same IPs

### If Meta Pixel still doesn't load:
- Check browser console for errors
- Verify SSL certificate is valid
- Check if ad blockers are interfering
- Test with Facebook Pixel Helper extension

---

## ⚠️ IMPORTANT: Vercel DNS Conflict

Vercel has detected conflicting DNS records that need to be removed:

**Remove these records:**
- ❌ A record: `@` → `136.110.143.166`
- ❌ AAAA record: `@` → `2600:1901:0:4095::`

**Action Required:**
1. Go to **Vercel Dashboard** → Settings → Domains
2. Get the **exact DNS records** Vercel wants you to use
3. Remove conflicting records from your DNS provider
4. Add Vercel's recommended records instead

See `VERCEL_DNS_SETUP.md` for detailed instructions.

---

**Status**: ⚠️ Conflicting DNS records - need to use Vercel's DNS configuration
**Next**: Remove conflicting records and use Vercel's recommended DNS setup

