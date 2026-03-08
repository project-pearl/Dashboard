# NIST 800-53 Control Mapping — PIN Dashboard

This document maps applicable NIST 800-53 Rev 5 controls to the PIN Dashboard implementation.

| Control | Title | PIN Implementation |
|---------|-------|-------------------|
| **AC-2** | Account Management | Supabase Auth manages user accounts; admin panel for role assignment; `profiles` table tracks roles and admin levels |
| **AC-6** | Least Privilege | Role-based access (Federal, State, MS4, K-12, etc.); admin tiers (`super_admin`, `role_admin`, `none`); CODEOWNERS enforces review gates on critical paths |
| **AU-2** | Event Logging | `admin_audit_log` table captures admin actions (role grants, user deletions); `invite_audit_log` tracks invitations |
| **AU-3** | Content of Audit Records | Audit entries include actor ID, actor email, action type, target ID, target email, timestamp, and JSON metadata |
| **AU-6** | Audit Record Review | Audit logs queryable via Supabase dashboard; future: scheduled report extraction |
| **CM-2** | Baseline Configuration | `vercel.json` defines cron schedules and route config; `package-lock.json` pins dependency versions; branch protection prevents unreviewed changes to `main` |
| **CM-8** | System Component Inventory | CycloneDX SBOM generated on every CI run; `npm audit` report archived as artifact; dependency-audit job runs daily |
| **IA-2** | Identification and Authentication | Supabase Auth with email/password and magic-link; JWT bearer tokens validated on every admin API route |
| **IA-5** | Authenticator Management | Supabase handles password hashing (bcrypt) and token lifecycle; `SECRETS_ROTATION.md` documents key rotation schedules |
| **SC-8** | Transmission Confidentiality | All traffic served over HTTPS (Vercel edge); Supabase connections use TLS; API keys transmitted only in server-side env vars |
| **SC-13** | Cryptographic Protection | Supabase Auth uses bcrypt for passwords; JWTs signed with HS256; HTTPS/TLS for data in transit |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-03-08 | Project Pearl | Initial mapping |
