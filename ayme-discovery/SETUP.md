# Formbricks discovery lab (no page objects), cloud container

Set up 2026-10-22 for the "live page object discovery" run: Formbricks running locally with Ayme in the page (React integration, WebMCP, Agent Connection in lab mode, Decision Endpoint) and **no page objects**. The discovery agent writes them from scratch through `ayme mcp` and the shipped skill (`skills/ayme`).

Status at hand-off: **running**. Verified: sign-in through the real UI, survey list, survey summary, survey responses (the 50 seeded responses list), survey editor; not exercised: creating a survey (writes data); `ayme mcp` paired with the page by itself and listed `snapshot` plus the Browser Tools and no Page Object Tool; `snapshot` returned the editor's tree.

## Where things are

| What | Path |
|---|---|
| ayme worktree (branch `claude/formbricks-lab`, fast-forwarded to origin/main `a805c3a`) | `/home/user/ayme/.claude/worktrees/formbricks-lab` |
| Formbricks checkout (the discovery agent's cwd) | `/home/user/ayme/.claude/worktrees/formbricks-lab/apps/lab-formbricks/formbricks` |
| Agent's `.mcp.json` (committed on the branch) | `<Formbricks checkout>/.mcp.json`: `npx --no -p @ayme-dev/mcp ayme mcp`, must start with cwd = the Formbricks checkout |
| Where new page objects go | `<Formbricks checkout>/apps/web/ayme/pom/*.ts` (folder does not exist yet; see "Build plumbing kept") |
| Where Ayme is mounted | `apps/web/ayme/AymeLab.tsx`, used in `apps/web/app/layout.tsx` |
| Scripts | `start.sh`, `stop.sh`, `refresh-ayme.sh` in this folder (the mount is noexec: run them with `bash <script>`) |
| Logs | `/tmp/formbricks-discovery/` (`app.log`, `dev-authzed.log`, `app.pid`); the currently running dockerd logs to `/tmp/claude-0/-home-user/348887ad-f471-5bed-a742-815836de1234/scratchpad/dockerd.log` (session scratch, may vanish); a dockerd started by `start.sh` logs to `/tmp/formbricks-discovery/dockerd.log` |

## Start / stop

```sh
bash /mnt/project-files/dogfood/formbricks-discovery/start.sh   # idempotent; ~2 min warm, first page compile ~20 s
bash /mnt/project-files/dogfood/formbricks-discovery/stop.sh    # app + containers; volumes (data) kept
```

`start.sh` does, in order: start `dockerd` if `docker info` fails (no systemd here; `/etc/docker/daemon.json` has the `mirror.gcr.io` mirror, dockerd picks up `HTTPS_PROXY` from the env); `docker compose up` of **postgres, valkey, mailhog, rustfs (+perms/init)** only; Formbricks's `dev:authzed` (SpiceDB, Prisma migrations, authz schema); on first start only the authz backfill + survey-scope marker (as `lab:dev` does); then `AYME_LAB=1 corepack pnpm@11.7.0 exec turbo run go --concurrency 20` under `setsid`, and waits for `/auth/login` = 200.

Running now: dockerd pid 9699; app session leader pid 17558 (`corepack pnpm@11.7.0 exec turbo run go`), its whole session = `ps -eo pid,sid | awk '$2==17558'`; next-server pid 19710. `stop.sh` kills that session by id. Do not `pkill -f` patterns that are in your own command line.

Memory: ~6 GB used in total with the app warm (next-server ~3.6 GB RSS, 7 vite watchers ~0.4-0.6 GB each), 15 GB machine, ~9 GB available. OK.

The lab app's own commands (`pnpm lab:dev`, `lab:stop`, `lab:qualify`) **do not work here**: they refuse because HEAD is not the pinned commit, `lab:dev` would start the hub images, and `lab:qualify` checks the page objects that were removed.

## URLs

- App: http://localhost:3000 (sign-in: http://localhost:3000/auth/login, then "Log in with Email")
- Survey list: http://localhost:3000/workspaces/clseedworkspace000000000/surveys
- Editor: `/workspaces/clseedworkspace000000000/surveys/<surveyId>/edit`; summary: `.../<surveyId>/summary`; responses: `.../<surveyId>/responses`
- MailHog: http://localhost:8025; SpiceDB gRPC 127.0.0.1:50051; Postgres localhost:5432 (postgres/postgres, db `formbricks`)
- `ayme mcp` listens on ws://127.0.0.1:9350 (range 9350-9365). A page pairs by itself only when exactly one server runs; none runs now.

## Sign-in and seeded data

Seeded with Formbricks's own seed (`corepack pnpm@11.7.0 db:seed` at the checkout root; idempotent upserts, never `--clear`), before the authz backfill.

| User | Password | Role |
|---|---|---|
| `admin@formbricks.com` | `Password#123` | owner (use this one) |
| `manager@formbricks.com` | `Password#123` | manager |
| `member@formbricks.com` | `Password#123` | member |

Organization `clseedorg0000000000000` "Seed Organization"; workspace `clseedworkspace000000000` "Seed Workspace".

| Survey id | Name | Status | Questions | Responses |
|---|---|---|---|---|
| `clseedsurveykitchen00` | Kitchen Sink Survey | inProgress | 12: openText, multipleChoiceSingle, multipleChoiceMulti, nps, cta, rating, consent, date, matrix, address, ranking, contactInfo | 50 |
| `clseedsurveycsat000000` | CSAT Survey | inProgress | rating (smiley, 5) | 50 |
| `clseedsurveycomplete00` | Exit Survey | completed | multipleChoiceSingle | 50 |
| `clseedsurveydraft00000` | Draft Survey | draft | openText | 0 |

Also seeded: demo workflows on the Kitchen Sink survey. More data: re-run the seed, or create surveys in the UI (a new survey starts restricted; activating it asks who can view it, as in `lab:dev`).

## The no-page-objects checkout

Formbricks checkout is on local branch **`discovery-no-poms`**, one commit `2e77b1f` on the pinned overlay `211ad70`, never pushed. It:

- deletes `apps/web/ayme/pom/` (SignInPage, SurveyNavigationPage, SurveyEditorPage, SurveySummaryPage), `apps/web/ayme/AymePageObjects.tsx` (their per-route registration) and `apps/web/ayme/qualification/` (the qualification suite full of locators);
- removes the `ayme-lab-page-objects` cookie switch from `AymeLab.tsx` / `lab-switches.ts` (Goal Loop cookie `ayme-lab-goal-loop=on` still works);
- adds `.mcp.json`; takes the `pnpm-lock.yaml` the current Ayme packages produce (only the peer versions `0.1.0` became `0.1.0-alpha.0`, plus registry deprecation notes).

**Build plumbing kept** (deliberate): the Turbopack rule in `apps/web/next.config.mjs` that runs `@ayme-dev/unplugin-ayme/turbopack-loader` on `apps/web/ayme/pom/*.ts` files that import `@ayme…`/use `extends`, `apps/web/ayme/tsconfig.pom.json` (generic compiler options, `include: pom/**/*.ts`) and `experimentalDecorators` in `apps/web/tsconfig.json`. So page objects the agent writes in `apps/web/ayme/pom/` compile without build work; the agent still has to register them (for example a client component calling `usePageObject` from `@ayme-dev/react`, rendered inside `AymeProvider` in `AymeLab.tsx`). Comments were reworded so they don't describe the removed page objects.

**Git history hidden**: the checkout's `.git` was replaced by a depth-1 clone of `discovery-no-poms` with no remote, so `git log`/`git show` cannot reach the old page objects (`git rev-list --all --objects | grep ayme/pom/` → 0). Grepped the whole checkout incl. `.ayme-lab/`, `node_modules`, `apps/web/.next` (after compiling the login, list, summary and editor routes): no trace of the old page objects (only upstream Formbricks's own `SurveyEditorPage` React component, which is unrelated).

Residual copies of the old page objects outside that checkout (tell the discovery agent not to read them; I couldn't remove them without touching `/home/user/ayme`):
- the original submodule git dir `/home/user/ayme/.git/worktrees/formbricks-lab/modules/apps/lab-formbricks/formbricks` (has 211ad70);
- GitHub `ayme-labs/formbricks` branch `ayme-overlay` (a `git fetch` from the network would get it);
- `/home/user/ayme/.claude/worktrees/formbricks-lab/apps/lab-formbricks/README.md` (describes the page objects and their locator tricks) and `apps/eval-formbricks/src/ayme.ts` (tool names like `SurveyEditorPage.setSurveyName`).

To restore the normal submodule later (e.g. before `lab:prepare`): `cd <Formbricks checkout> && rm -rf .git && echo 'gitdir: ../../../../../../.git/worktrees/formbricks-lab/modules/apps/lab-formbricks/formbricks' > .git && git checkout -f 211ad704d` (the branch `discovery-no-poms` also exists there as `2e77b1f`; untracked page objects the agent wrote would need saving first).

## After Ayme's packages change

Do **not** run `pnpm lab:prepare`: it checks the submodule out at the pinned commit (page objects back) and refuses this checkout. Instead:

```sh
cd /home/user/ayme/.claude/worktrees/formbricks-lab && git merge --ff-only origin/main && CLAUDE_CODE_REMOTE=true scripts/prepare-cloud-checkout.sh
bash /mnt/project-files/dogfood/formbricks-discovery/stop.sh
bash /mnt/project-files/dogfood/formbricks-discovery/refresh-ayme.sh   # build+pack the 5 Ayme packages into .ayme-lab, reinstall, clear .next
bash /mnt/project-files/dogfood/formbricks-discovery/start.sh
```

If `refresh-ayme.sh` leaves `pnpm-lock.yaml` modified, commit it on `discovery-no-poms` (the hooks don't run in the shallow clone).

## Giving the agent the MCP server

- Through the rig (as I verified): the rig reads `<Formbricks checkout>/.mcp.json` itself. The rig copy I used lives in this session's scratch and may be gone: copy `/mnt/project-files/dogfood/rig/` into a fresh folder outside the checkout and symlink its `node_modules/@modelcontextprotocol/sdk` and `node_modules/playwright` to `<Formbricks checkout>/node_modules/@modelcontextprotocol/sdk` and `.../node_modules/playwright`; run `APP_DIR=<Formbricks checkout> RIG_PORT=7788 CHROME=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell node agent-mcpjson.mjs`.
- As Claude Code started in the checkout: a project `.mcp.json` needs interactive approval, which nobody gives overnight. Pass it explicitly instead: `claude --strict-mcp-config --mcp-config <Formbricks checkout>/.mcp.json ...` (what `apps/eval-formbricks/src/claude.ts` does), with cwd = the checkout so `npx --no` finds the local `@ayme-dev/mcp`.
- The agent's own browser must open http://localhost:3000 (sign in as admin); on localhost the tab pairs by itself when exactly one `ayme mcp` runs, else via the link `ayme_connect` returns.

## Verifying `ayme mcp` (what I did)

The dogfood rig copied to `/tmp/claude-0/-home-user/348887ad-f471-5bed-a742-815836de1234/scratchpad/rig` (node_modules symlinked to the Formbricks checkout's `@modelcontextprotocol/sdk` and `playwright`), started with `APP_DIR=<Formbricks checkout> RIG_PORT=7788 CHROME=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell node agent-mcpjson.mjs`. Opening http://localhost:3000/auth/login paired the tab by itself (no `ayme_connect` needed). Tools on sign-in, summary and editor alike: `ayme_connect, ayme_list_tools, ayme_call, snapshot, click, hover, type, fill, check, uncheck, select_option, fill_form, press_key, generate_locator, screenshot, navigate, navigate_back, navigate_forward, reload`, with no Page Object Tool and no `goal`. Rig and server stopped afterwards.

## Quirks

- **No hub / cube**: `ghcr.io/formbricks/hub:0.8.5` can't be pulled (the proxy answers 403 for `pkg-containers.githubusercontent.com`), so hub, hub-migrate, hub-worker and cube (depends on hub-migrate) are not started. Sign-in, survey list, editor and summary work without them; "Feedback Data", "Analysis" and dashboards will likely error. Don't use `pnpm go`/`db:up` (they start every service and fail on hub).
- The Docker Hub images (pgvector, spicedb, valkey, rustfs, mailhog, busybox, cube) pulled fine through mirror.gcr.io/the proxy.
- pnpm install OOMs at Node's default 2 GB heap (pnpm 11 parses full registry metadata for the `minimumReleaseAge` policy; the earlier "slow requests then ELIFECYCLE" was this crash). Use `NODE_OPTIONS=--max-old-space-size=8192`. The npm registry itself is fast here.
- Node is v22.22 while Formbricks wants 24: only warnings so far.
- The editor shows "File storage not set up, uploads will likely fail" and "Auto-save disabled" banners; Next's dev overlay shows "1 Issue" (not identified; possibly the `turbopack.root` warning in `app.log`; a dev-mode badge, appears in snapshots as `button "Open Next.js Dev Tools"` / `"Open issues overlay"`).
- The log shows `WorkflowStepFailedError: Recipient respondent@example.com cannot access this workspace` from the seeded demo workflows: harmless.
- The first visit to each route compiles it (20-30 s); later visits are fast.
- `AYME_OPENROUTER_API_KEY` is not set, so the Decision Endpoint answers 503 (Goal Loop unusable; irrelevant without the cookie).
- The browser console shows `ws://127.0.0.1:935x/probe ... ERR_CONNECTION_REFUSED` for the ports where no server listens: that is the page client looking for servers, expected.
