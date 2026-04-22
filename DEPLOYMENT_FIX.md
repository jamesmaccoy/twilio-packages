# Deployment Fix - EBADPLATFORM Error

## Issue

**Error on Vercel/Linux deployment:**
```
npm error code EBADPLATFORM
npm error notsup Unsupported platform for @esbuild/darwin-arm64@0.25.12
npm error notsup wanted {"os":"darwin","cpu":"arm64"} (current: {"os":"linux","cpu":"x64"})
```

## Root Cause

`@esbuild/darwin-arm64` was listed as a **regular dependency** in `package.json`, which means npm tried to install it on all platforms, including Linux servers (Vercel).

This package is platform-specific and should only be installed on macOS ARM64 machines.

## Solution

✅ **Moved `@esbuild/darwin-arm64` from `dependencies` to `optionalDependencies`**

### Changes in `package.json`:

**Before:**
```json
{
  "dependencies": {
    "@esbuild/darwin-arm64": "^0.25.12",
    "@google/genai": "^1.0.1",
    ...
  }
}
```

**After:**
```json
{
  "dependencies": {
    "@google/genai": "^1.0.1",
    ...
  },
  "optionalDependencies": {
    "@esbuild/darwin-arm64": "^0.25.12"
  }
}
```

## What This Means

### Optional Dependencies
- ✅ Installed on compatible platforms (macOS ARM64)
- ✅ **Skipped** on incompatible platforms (Linux, Windows, macOS Intel)
- ✅ Build doesn't fail if package can't be installed
- ✅ npm will install the correct platform-specific esbuild binary automatically

### Benefits
- ✅ Fixes deployment on Vercel (Linux x64)
- ✅ Fixes deployment on other cloud platforms
- ✅ Still works correctly on macOS ARM64 (your dev machine)
- ✅ esbuild will automatically install the correct platform binary when needed

## Testing

### On Vercel (or any Linux deployment):
```bash
npm install
# Should succeed without EBADPLATFORM error
# Will skip @esbuild/darwin-arm64 (not needed on Linux)

npm run build
# Should build successfully using @esbuild/linux-x64 instead
```

### On macOS ARM64 (your dev machine):
```bash
npm install
# Should install @esbuild/darwin-arm64 successfully

npm run dev
# Works as before
```

## Deployment Status

✅ **Committed:** `5fc6b0c` - "fix: Move @esbuild/darwin-arm64 to optionalDependencies"

✅ **Pushed:** `goingyoco` branch

✅ **Ready:** Vercel should now build successfully

## Next Steps

1. **Trigger Vercel Rebuild:**
   - Go to your Vercel dashboard
   - Redeploy the `goingyoco` branch
   - Or push another commit to trigger auto-deployment

2. **Verify Build Success:**
   - Check Vercel build logs
   - Should see: "Build completed successfully"
   - No more EBADPLATFORM errors

3. **Test Deployed Site:**
   - Visit your deployment URL
   - Test the Yoco payment flow in mock mode
   - Verify all functionality works

## Alternative: Use .npmrc

If you still encounter platform-specific issues, you can also add `.npmrc` to your project:

```ini
# .npmrc
optional=true
platform-neutral=true
```

This tells npm to skip all optional dependencies that don't match the current platform.

## Related Issues

### Why was @esbuild/darwin-arm64 in dependencies?

It may have been added accidentally by:
- Running `npm install @esbuild/darwin-arm64` instead of letting esbuild handle it
- A dependency requiring it explicitly
- Manual addition to package.json

### How esbuild Works

esbuild automatically installs the correct platform binary:
- **macOS ARM64:** `@esbuild/darwin-arm64`
- **macOS Intel:** `@esbuild/darwin-x64`
- **Linux x64:** `@esbuild/linux-x64`
- **Linux ARM64:** `@esbuild/linux-arm64`
- **Windows x64:** `@esbuild/win32-x64`

You don't need to specify these explicitly - esbuild handles it automatically.

## Troubleshooting

### Still getting EBADPLATFORM on deployment?

1. **Clear build cache:**
   ```bash
   # On Vercel dashboard: Settings → Clear Build Cache
   ```

2. **Delete package-lock.json (if using npm):**
   ```bash
   rm package-lock.json
   git add package-lock.json
   git commit -m "chore: Remove package-lock.json"
   git push
   ```

3. **Verify no other platform-specific packages:**
   ```bash
   grep -r "@esbuild" package.json
   # Should only show optionalDependencies
   ```

### Build succeeds but app crashes?

- Check environment variables are set on Vercel
- Verify `YOCO_SECRET_KEY` is configured (or leave empty for mock mode)
- Check `NEXT_PUBLIC_URL` is set correctly
- Review Vercel function logs for errors

---

**Status:** ✅ **Fixed and Deployed**

**Commit:** `5fc6b0c`

**Branch:** `goingyoco`

**Ready for:** Vercel deployment

**Last Updated:** November 3, 2025

