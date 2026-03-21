# Deployment Fix Instructions

## Issue: Missing ADMIN_EMAILS Environment Variable

### Error Message:
```
❌ ADMIN_EMAILS environment variable must be set in production
```

### Solution:

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Select your project
   - Navigate to **Settings** → **Environment Variables**

2. **Add ADMIN_EMAILS Variable**
   - Variable Name: `ADMIN_EMAILS`
   - Variable Value: `admin@project-pearl.org,your-email@example.com`
   - Environment: **Production**, **Preview**, **Development** (check all)
   - Click **Save**

3. **Redeploy**
   - Go to **Deployments** tab
   - Click **"Redeploy"** on the latest deployment
   - Or push a new commit to trigger automatic deployment

### Example Values:
```bash
# Single admin
ADMIN_EMAILS=admin@project-pearl.org

# Multiple admins (comma-separated)
ADMIN_EMAILS=admin@project-pearl.org,doug@project-pearl.org,system@project-pearl.org
```

### What This Variable Does:
- Grants super admin privileges to specified email addresses
- Enables access to admin panels and role management
- Required for production security and user management

---

## Fixed Issues in Latest Deployment:

✅ **CSP Violation**: Added missing nonce to JSON-LD script tag
✅ **Cron Limit**: Consolidated weekly crons (83/100 limit)
✅ **Build Errors**: All parsing errors resolved
✅ **HUC-14 Premium**: Fully implemented and operational

**Next**: Set ADMIN_EMAILS environment variable in Vercel to complete deployment.