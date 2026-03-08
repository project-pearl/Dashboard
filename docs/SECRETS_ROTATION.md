# Secrets Rotation Policy — PIN Dashboard

## Overview

All secrets are stored as Vercel environment variables and are never committed to source control. This document defines rotation schedules and step-by-step procedures.

## Secret Inventory

| Secret | Purpose | Rotation Schedule |
|--------|---------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Rotate on project migration only |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Quarterly or on suspected compromise |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (full DB access) | Quarterly |
| `CRON_SECRET` | Authenticates cron job invocations | Quarterly |
| `OPENAI_API_KEY` | AI insights generation (GPT-4) | Quarterly or on suspected compromise |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage access | Quarterly |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox map tiles (public, scoped) | Annually or on abuse detection |
| `SENTINEL_API_KEY` | Sentinel alert ingestion | Quarterly |

## Rotation Procedure

### 1. Generate new secret

- **Supabase keys:** Supabase Dashboard > Settings > API > Regenerate
- **CRON_SECRET:** `openssl rand -base64 32`
- **OPENAI_API_KEY:** OpenAI Dashboard > API Keys > Create new key
- **BLOB_READ_WRITE_TOKEN:** Vercel Dashboard > Storage > Blob > Regenerate token
- **MAPBOX token:** Mapbox Account > Access tokens > Create / rotate
- **SENTINEL_API_KEY:** Sentinel admin portal > API credentials > Regenerate

### 2. Update Vercel environment variables

```bash
# For each secret:
vercel env rm SECRET_NAME production
vercel env add SECRET_NAME production
# Paste the new value when prompted
```

### 3. Redeploy

```bash
vercel --prod
```

### 4. Verify

- Confirm cron jobs execute (check `/api/cache-status`)
- Confirm map tiles load on dashboard
- Confirm AI insights generate for at least one state
- Confirm admin operations (role grant/revoke) succeed

### 5. Revoke old secret

- Disable or delete the previous key/token in the provider dashboard
- Verify no errors after 24 hours

## Emergency Rotation

If a secret is suspected compromised:

1. **Immediately** generate a new secret and update Vercel env vars
2. Redeploy to production
3. Revoke the old secret in the provider dashboard
4. Review `admin_audit_log` and Vercel function logs for unauthorized access
5. File an incident per `INCIDENT_RESPONSE.md`

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-03-08 | Project Pearl | Initial policy |
