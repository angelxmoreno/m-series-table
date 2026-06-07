# Forking this project

This guide is for people who want to run **their own version** of the Apple
Silicon M-Series Comparison table on their own domain or GitHub Pages site.
If you want to **contribute changes back to the original project** instead,
see [`CONTRIBUTING.md`](./CONTRIBUTING.md) — that's a different workflow.

## Quick start

```bash
git clone https://github.com/<you>/m-series-table
cd m-series-table
bun install
bun run dev
```

The dev server runs on `http://localhost:5173` by default. The table
renders with the bundled dataset, no API or backend needed.

## Deploying your fork to GitHub Pages

This repo deploys automatically to GitHub Pages on every push to `main`,
served via the [`deploy.yml`](./.github/workflows/deploy.yml) workflow.
Forks inherit the workflow but not the publishing permission — you have to
opt in:

1. In your fork on GitHub, go to **Settings → Pages**.
2. Under **Source**, choose **GitHub Actions**.
3. Push to `main` (or trigger the workflow manually from the Actions tab).
4. Your site will be live at `https://<you>.github.io/m-series-table/` within
   a minute or two.

## Custom domain

The original repo is served at **m-series.axmdev.app** via a `public/CNAME`
file. To use your own custom domain:

1. **Update the CNAME file** in your fork's `public/` directory to your
   domain (e.g. `chips.example.com`).
2. **DNS records** at your registrar:
   - For an **apex domain** (e.g. `example.com`): add four `A` records
     pointing to GitHub's Pages IPs: `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153`.
   - For a **subdomain** (e.g. `chips.example.com`): add a `CNAME` record
     pointing to `<you>.github.io`.
3. In your fork's GitHub Pages settings, type your custom domain and save.
4. Wait for DNS to propagate (can take up to 24 hours, usually minutes).

The `base: "/"` setting in [`vite.config.ts`](./vite.config.ts) is correct
for both custom-domain hosting and the default `<you>.github.io/<repo>/`
path. **Don't change it** unless you have a specific reason — see the
troubleshooting section below.

## PostHog (analytics)

The original project uses PostHog to track a small number of analytics
events (search, sort, filter, column toggle, CSV export). Your fork will
inherit the production PostHog project and quota, which is not what you
want.

To run your fork with your own PostHog project:

1. Sign up at [posthog.com](https://posthog.com) (free tier is fine).
2. Create a new project, copy the project token.
3. In your fork's GitHub repo, go to **Settings → Secrets and variables →
   Actions** and add:
   - `VITE_POSTHOG_PROJECT_TOKEN` = the new token
   - `VITE_POSTHOG_HOST` = your PostHog host (e.g.
     `https://us.i.posthog.com` or your self-hosted URL)
4. For local development, copy `.env.example` (if present) to `.env` and
   fill in the same values, or just set the variables in your shell.

The build will inject these values at compile time. Without them, PostHog
silently no-ops — the site still works, you just don't get analytics.

## Troubleshooting

### "My fork builds but the page is blank"

Almost always the `base` setting in `vite.config.ts`. The default is `"/"`,
which is correct for both custom-domain hosting and the default
`<you>.github.io/<repo>/` path. If you've moved the build to a non-standard
subpath (e.g. hosting under `https://example.com/some/other/path/`), change
`base` to `"/some/other/path/"`. If you don't know what to set, leave it
alone.

### "My custom domain 404s"

Two common causes:
- **DNS hasn't propagated yet.** It can take up to 24 hours, though it's
  usually minutes. Check with `dig chips.example.com` or
  [dnschecker.org](https://dnschecker.org).
- **Wrong CNAME target.** GitHub Pages expects `CNAME` records pointing to
  `<you>.github.io` (not the apex domain, not `github.com`).

### "PostHog isn't loading / no events showing up"

- The GitHub Actions secrets on your fork aren't set, or are set to the
  upstream project's token. See the PostHog section above.
- The browser console (F12 → Console) will show a PostHog initialization
  message — if it says "initialized without a token", the build didn't
  have the env vars.

### "The build is failing in CI but works locally"

Usually a dependency version mismatch. `bun install --frozen-lockfile` is
strict about `bun.lock` matching `package.json`. If you added a dependency
locally without committing the lockfile update, push the lockfile change.

## Contributing changes back upstream

If you make a change to your fork that you think would also be useful in
the original project, open a pull request back to
[`angelxmoreno/m-series-table`](https://github.com/angelxmoreno/m-series-table).
See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the workflow. Most data
corrections and small UX fixes are welcome.
