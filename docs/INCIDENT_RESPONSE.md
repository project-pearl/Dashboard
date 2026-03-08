# Incident Response Plan — PIN Dashboard

## 1. Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P1 — Critical** | Data breach, full outage, or active exploitation | Immediate (< 1 hour) | API key leaked publicly; database exposed; auth bypass |
| **P2 — High** | Partial outage, data integrity risk, or significant security flaw | < 4 hours | Cache poisoning; cron jobs failing for 24+ hrs; Sentinel false escalation causing incorrect alerts |
| **P3 — Medium** | Degraded functionality, non-critical vulnerability | < 24 hours | Single data source stale; non-exploitable dependency CVE; UI rendering issue |
| **P4 — Low** | Cosmetic issues, minor bugs, improvement requests | Next business day | Typo in report; minor styling issue; non-urgent feature gap |

## 2. Roles

| Role | Responsibility |
|------|---------------|
| **Incident Commander (IC)** | Coordinates response, makes escalation decisions, communicates status |
| **Technical Lead** | Investigates root cause, implements fix, validates remediation |
| **Communications Lead** | Drafts stakeholder updates, manages notification channels |

## 3. Detection

- **Automated:** GitHub Dependabot alerts, Semgrep SAST findings, Vercel deployment failure notifications, Sentinel anomaly alerts
- **Manual:** User reports, cache-status dashboard checks, periodic log review
- **Monitoring endpoints:** `/api/cache-status` (all 19 caches), Vercel function logs

## 4. Triage

1. Confirm the incident is real (not a false positive)
2. Assign severity level (P1–P4)
3. Designate Incident Commander
4. Create tracking issue in GitHub
5. Begin investigation

## 5. Containment

| Scenario | Containment Action |
|----------|-------------------|
| **API key compromise** | Rotate key immediately (see `SECRETS_ROTATION.md`), redeploy, revoke old key |
| **Cache poisoning** | Disable affected cron job, clear blob cache, rebuild from upstream API |
| **Auth bypass** | Enable Supabase maintenance mode, audit `admin_audit_log` for unauthorized actions |
| **Sentinel false escalation** | Disable Sentinel alert forwarding, notify stakeholders of false alert, review thresholds |
| **Dependency vulnerability** | Pin known-good version in `package-lock.json`, deploy patch, verify with `npm audit` |

## 6. Eradication

1. Identify root cause
2. Develop and test fix in a branch
3. PR with required review (CODEOWNERS enforced)
4. Verify Semgrep and dependency-audit pass
5. Deploy to production

## 7. Recovery

1. Verify all cron jobs executing normally (`/api/cache-status`)
2. Confirm no unauthorized data access in audit logs
3. Monitor error rates for 24 hours post-fix
4. Re-enable any disabled services

## 8. Communication Templates

### Internal Status Update (P1/P2)

```
Subject: [P{N}] {Brief description}
Status: {Investigating | Contained | Resolved}
Impact: {Description of affected functionality}
Next update: {Time}
IC: {Name}
```

### Stakeholder Notification (P1)

```
Subject: PIN Dashboard — Service Incident Notice

We identified an issue affecting {description}. Our team is actively
working on resolution. Current status: {status}.

No action is required on your part. We will provide an update by {time}.
```

## 9. Post-Incident Review

Within 48 hours of resolution:

1. **Timeline:** Chronological sequence of events
2. **Root cause:** What failed and why
3. **Impact:** Users/data affected
4. **Response assessment:** What went well, what could improve
5. **Action items:** Preventive measures with owners and deadlines
6. Document in `docs/post-incident/YYYY-MM-DD-{slug}.md`

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-03-08 | Project Pearl | Initial plan |
