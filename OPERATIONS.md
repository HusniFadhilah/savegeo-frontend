# SAVEGEO Frontend Operations Runbook

## Local workflow

1. Install Node.js 20 LTS.
2. Run `npm ci`.
3. Create `.env.local` with `VITE_API_BASE_URL=http://localhost:8086/api`.
4. Start the app with `npm run dev`.
5. Open `http://localhost:5501`.

Production builds must use `VITE_API_BASE_URL=/api` so browser requests remain same-origin.

## Required checks

```powershell
npm run lint
npm test
npm audit --audit-level=high
npm run build
```

Gitleaks runs in the deployment workflow before the build is deployed.

## GitHub Actions configuration

Production deployment secrets:

| Secret | Purpose |
|---|---|
| `DEPLOY_HOST` | Production server hostname/IP |
| `DEPLOY_SSH_PORT` | Production SSH port |
| `DEPLOY_USER` | Production SSH user |
| `FRONTEND_REMOTE_DIR` | Frontend path on production |
| `FRONTEND_APACHE_SITE_PATH` | Apache virtual-host path |
| `FRONTEND_NGINX_TIMEOUTS_PATH` | Optional Nginx timeout path |
| `FRONTEND_HEALTH_URL` | Frontend health URL |
| `FRONTEND_CURL_RESOLVE` | Optional private DNS resolution |
| `VPN_CONFIG_B64` | Base64 OpenVPN configuration |
| `VPN_AUTH_B64` | Base64 OpenVPN credentials |
| `SSH_KNOWN_HOSTS` | SSH host fingerprints |
| `SSH_PASSWORD` | Production SSH password |

Doltinuku deployment secrets:

| Secret | Purpose |
|---|---|
| `SFTP_DOLTINUKU_SERVER` | Doltinuku hostname/IP |
| `SFTP_DOLTINUKU_PORT` | SFTP/SSH port |
| `SFTP_DOLTINUKU_USERNAME` | SFTP/SSH user |
| `SFTP_DOLTINUKU_PASSWORD` | SFTP/SSH and sudo password |

AI review uses `OCR_LLM_URL`, `OCR_LLM_AUTH_TOKEN`, `OCR_LLM_MODEL`, and optional `OCR_LLM_USE_ANTHROPIC`.

## Deployment sequence

1. Pull Request runs CI and AI code review.
2. Merge to `main` triggers the selected server workflow.
3. Lint, unit tests, npm audit, build, and Gitleaks must pass.
4. The `dist/` artifact is uploaded to the target server.
5. Apache/Nginx is reloaded and public URLs are checked.

Production and Doltinuku workflows are independent and use separate secrets.

## Reverse proxy contract

The target web server must serve the Vite `dist/` directory and proxy:

```text
/api/                  -> FastAPI backend
/disaster-thumbnails/  -> FastAPI static thumbnail route
```

Required public checks:

```powershell
curl.exe -k -I https://savegeo.husnifd.my.id/
curl.exe -k https://savegeo.husnifd.my.id/api/health
curl.exe -k https://begeo.husnifd.my.id/api/health
```

## Troubleshooting

- Bundle contains `localhost`: rebuild with `VITE_API_BASE_URL=/api`.
- CORS error: verify same-origin `/api` and the reverse proxy.
- Thumbnail `404`: verify `/disaster-thumbnails/` proxy and backend raster directory.
- Blank screen: inspect browser console and check the deployed `index.html` asset hash.
- Stale UI: use a hard refresh and verify the latest workflow commit.
