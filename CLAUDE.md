# Rent Manager — Claude Instructions

## Deployment workflow (cPanel shared hosting)

Every code change that needs to go to production requires a **local build** before pushing.
The server runs the committed `.next` folder — it cannot build on the server (not enough memory, Prisma crashes).

### After making any code changes:

1. Build locally:
   ```bash
   npm run build
   ```

2. Commit source + build:
   ```bash
   git add .
   git commit -m "your message"
   git push origin master
   ```

3. On the server (cPanel terminal):
   ```bash
   source ~/nodevenv/easy-rent.xpertthemes.com/20/bin/activate
   cd ~/easy-rent.xpertthemes.com
   git fetch origin && git reset --hard origin/master
   node scripts/check-deps.js     # restores node_modules symlink + WA stack if needed
   node scripts/sync-prisma.js
   touch tmp/restart.txt
   ```

4. Wait ~30 seconds for the app to restart.

### Important rules
- Always run `npm run build` before committing and pushing — the server uses the committed `.next` folder.
- Never commit `.next/cache/` or `.next/dev/` — they are too large for GitHub (100MB+). They are in `.gitignore`.
- Never run `prisma generate` on the server — it crashes (OpenSSL/EAGAIN on cPanel).
- Never `npm run build` on the server — not enough memory.
- `BYPASS_PHONE_OTP` must be `false` in production `.env` for real WhatsApp OTP sending.
- `node scripts/check-deps.js` is idempotent and safe to re-run. It heals two recurring failure modes: CloudLinux turning `node_modules` from a symlink into a real folder, and the WhatsApp Direct stack (Baileys + deps) vanishing from the nodevenv.
