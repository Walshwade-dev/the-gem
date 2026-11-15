# Emergency Runbook: Revoke All Sessions & Store Lockdown

## When to Use
- Suspected theft or compromise of a salesperson device or Master credentials.
- Unexplained refresh-token reuse or repeated unauthorized access alerts.

## Step 1: API Emergency Lockdown (Preferred)
Master authenticates with fresh Clerk MFA (`iat <= 300s`):

```bash
curl -X POST https://<api-host>/security/lockdown \
  -H "Authorization: Bearer <MASTER_CLERK_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Suspected device compromise"}'
```

To only revoke all active seller sessions without activating store lockdown:

```bash
curl -X POST https://<api-host>/security/revoke-all-sessions \
  -H "Authorization: Bearer <MASTER_CLERK_JWT>"
```

## Step 2: Direct SQL Fallback (If API is Unavailable)
Run using `migrator_user` or `app_user`:

```sql
UPDATE sessions
SET revoked_at = NOW()
WHERE revoked_at IS NULL;

-- Optional full store lockdown for a specific master_id:
INSERT INTO security_lockdowns (master_id, reason, is_active, triggered_by)
VALUES ('<MASTER_UUID>', 'Emergency CLI lockdown', TRUE, '<MASTER_UUID>');
```

## Step 3: Recovery
Once the compromised device is blocked (`POST /security/devices/:id/block`) and passwords rotated, Master clears lockdown:

```bash
curl -X POST https://<api-host>/security/unlockdown \
  -H "Authorization: Bearer <MASTER_CLERK_JWT>"
```
