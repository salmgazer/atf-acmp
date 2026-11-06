# Production portal domains

The primary portal address is `https://build.atfchallenge.org`. The existing `app.atfchallenge.org` and `built.atfchallenge.org` addresses remain supported aliases. The API stays at `https://api.atfchallenge.org`.

Vercel hosts the domain's authoritative DNS. The `build` CNAME points to the existing AWS ECS Express Gateway load balancer, where the production web service runs. The existing HTTPS certificate covers the new hostname. An HTTP listener redirects requests to HTTPS while preserving the hostname, path and query.

Production GitHub environment variables:

| Variable | Value |
| --- | --- |
| `FRONTEND_URL` | `https://build.atfchallenge.org` |
| `CORS_ORIGIN` | `https://app.atfchallenge.org,https://built.atfchallenge.org,https://build.atfchallenge.org` |

The deployment workflow passes `CORS_ORIGIN` into the API as `CORS_ORIGINS`. HTTP authentication, chat and notification sockets allow the configured portal origins. `FRONTEND_URL` controls links in invitations, password-reset emails, certificates and brief-event notifications. Public frontend API and socket URLs continue pointing to the existing API service, so a frontend image rebuild is not needed for the new portal hostname.

`scripts/update-alb-rules.sh production` refreshes the API route and all three portal routes from the active ECS Express Gateway targets after a deployment. The dedicated `build.atfchallenge.org` host rule was created alongside the existing alias rules. Keep these rules when changing infrastructure; the script expects exactly one host rule for each supported domain.

The production workflow checks API readiness, the primary portal's web health endpoint and the existing aliases. It retries briefly to allow routing updates to propagate. After a release, also verify login-page loading, API and socket CORS responses from the primary origin, and that the runtime `FRONTEND_URL` matches the GitHub setting. This domain change requires no database migration.
