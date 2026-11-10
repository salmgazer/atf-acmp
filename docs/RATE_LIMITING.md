# Proxy-aware authentication and onboarding limits

- [x] Resolve the real client through only the immediate, explicitly trusted ALB peer.
- [x] Scope authenticated API and password-change counters to the verified account, not its IP or submitted body fields.
- [x] Keep authentication and recovery attempt limits, with separate campus/carrier-safe network ceilings.
- [x] Exempt every named throttle window from health probes.
- [x] Return standard `Retry-After` plus a structured retry duration; log route/scope without personal data.
- [x] Keep login/onboarding entries and sessions on HTTP 429, with a retry countdown and no automatic mutation retries.

Each rollout must verify staging/production image versions, proxy configuration and readiness before completion is reported.

## Incident and correction

The original guard used Express `req.ip` without proxy trust. The API is behind an ALB, so unrelated clients were counted under the ALB's internal addresses. Authentication allowed only 3 requests/second, 5/minute and 20/hour on each route, per tracker and API replica. A local reproduction sent six distinct forwarded clients through one proxy; the sixth received HTTP 429.

`TRUST_PROXY_CIDRS` must contain the existing ALB subnet CIDRs in staging and production. API startup fails when this setting is missing there, or contains wildcard/boolean/global-CIDR/invalid values. Development defaults to no proxy trust. Only hop zero is trusted, and only if its address belongs to those subnets: client-supplied leading `X-Forwarded-For` entries cannot select the tracker. Production's task ingress was verified to allow port 3000 only from the ALB security group. The existing ALB uses XFF append mode. No network rules or CORS origins were broadened.

Authenticated requests use the verified principal's role and ID. Sensitive public authentication routes use a normalized email fingerprint, or an opaque credential fingerprint for refresh/reset/Firebase flows; missing identities fall back to the trusted client IP. Credentials, emails and IPs are never included in rate-limit logs. Unverified request-body IDs and portal changes cannot select another account's bucket.

Existing per-account authentication limits remain 3/second, 5/minute, 20/hour. Sensitive recovery endpoints retain 1/second, 3/minute, 10/hour. Public authentication additionally has per-client-IP ceilings of 30/second, 600/minute and 6,000/hour **per route**, allowing legitimate groups sharing NAT without removing network abuse controls. General authenticated API defaults remain 10/second, 100/minute and 1,000/hour per route, now isolated per account. Bulk/upload decorators remain in effect per verified staff account. These are in-process counters, as before: replicas have independent counters, and replacement/restart resets them. No Redis queue, cache, durable invitation record or database schema is changed by this hotfix.

HTTP 429 includes `retryAfterSeconds`, a standard `Retry-After` header and a readable message. Browser login/onboarding disable retry submission during the countdown without clearing entries. A rate-limited refresh is not treated as proof that a session is invalid; genuine authentication failure still follows the existing logout path. Health checks skip all three configured named windows, so monitoring cannot exhaust a user-facing allowance.

Environment rollout: set the verified ALB CIDRs in the `TRUST_PROXY_CIDRS` GitHub environment variable for both environments, then deploy through the existing staging-first release flow. Zoom/Resend configuration and empty SMTP values must remain unchanged. No migration, participant reimport or credential reset is needed.
