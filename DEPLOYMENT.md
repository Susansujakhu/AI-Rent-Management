# cPanel Deployment Guide — Easy Rent Manager

## Prerequisites
- cPanel hosting with **Node.js 20+** support (Setup Node.js App)
- MySQL database access
- SSH/Terminal access in cPanel
- Git repository on GitHub

---

## Step 1: Create MySQL Database

1. cPanel → **Database Wizard**
2. Create database: `yourprefix_rentapp`
3. Create user: `yourprefix_rentuser` (use Password Generator, save the password)
4. Add user to database with **ALL PRIVILEGES**

---

## Step 2: Create Subdomain

1. cPanel → **Subdomains**
2. Subdomain: `easy-rent` → Domain: `yourdomain.com`
3. Note the document root: `/home/username/easy-rent.yourdomain.com`

---

## Step 3: Setup Node.js App

1. cPanel → **Setup Node.js App** → **Create Application**
2. Fill in:
   - **Node.js version:** 20.x (or latest LTS)
   - **Application mode:** Production
   - **Application root:** `easy-rent.yourdomain.com`
   - **Application URL:** `easy-rent.yourdomain.com`
   - **Application startup file:** `server.js`
3. Click **Create**

---

## Step 4: Clone the Repository

Open cPanel **Terminal** and run:

```bash
# Activate the Node.js virtual environment (copy from cPanel Node.js app page)
source /home/username/nodevenv/easy-rent.yourdomain.com/20/bin/activate

# Navigate to app directory
cd ~/easy-rent.yourdomain.com

# Clone the repo
git clone https://github.com/Susansujakhu/AI-Rent-Management.git .
```

---

## Step 5: Create `.env` File

```bash
cat > .env << 'ENVEOF'
DB_PROVIDER="mysql"
DATABASE_URL="mysql://yourprefix_rentuser:URL_ENCODED_PASSWORD@localhost:3306/yourprefix_rentapp"
TENANT_PORTAL_ENABLED="true"
NEXT_PUBLIC_APP_URL="https://easy-rent.yourdomain.com"
BYPASS_PHONE_OTP="true"
ENVEOF

# Remove trailing ENVEOF line if it appears in file
sed -i '$ { /^ENVEOF$/d }' .env
cat .env
```

> **Important:** URL-encode special characters in the password:
> - `@` → `%40`
> - `^` → `%5E`
> - `#` → `%23`

---

## Step 6: Install Dependencies

```bash
# Restore node_modules as symlink (required for cPanel virtualenv)
rm -rf node_modules
ln -s /home/username/nodevenv/easy-rent.yourdomain.com/20/lib/node_modules ./node_modules

# Install packages (skip postinstall scripts to avoid Prisma generate errors)
npm install --ignore-scripts

# Generate Prisma client manually
./node_modules/.bin/prisma generate --schema=./prisma/schema.prisma

# Push database schema to MySQL
./node_modules/.bin/prisma db push --schema=./prisma/schema.prisma
```

---

## Step 7: Deploy the Built App

The app must be **built locally on Windows** (not on the server) due to cPanel Turbopack/symlink incompatibility.

### On your local machine:

```bash
# Make sure local .env uses SQLite for building
# (The build doesn't make DB calls, so SQLite is fine)

npm run build
```

> The build uses `--webpack` flag (configured in package.json) to avoid Turbopack symlink issues on cPanel.

### Push built files via Git:

The `.next` folder is temporarily included in git for deployment. After building locally:

```bash
git add .next/server .next/static .next/BUILD_ID .next/build-manifest.json \
  .next/routes-manifest.json .next/app-path-routes-manifest.json \
  .next/package.json .next/prerender-manifest.json \
  .next/required-server-files.json .next/required-server-files.js \
  .next/images-manifest.json .next/export-marker.json

git commit -m "deploy: update .next build"
git push origin master
```

### On the server, pull the build:

```bash
git pull origin master
```

---

## Step 8: Start the App

1. Go to cPanel → **Setup Node.js App**
2. Find your app → click **Restart**
3. Visit `https://easy-rent.yourdomain.com`

---

## Step 9: Create Admin User

1. Sign up at `https://easy-rent.yourdomain.com/signup`
2. Use OTP code `000000` (BYPASS_PHONE_OTP is enabled)
3. After signup, run in server terminal:

```bash
mysql -u yourprefix_rentuser -p'YOUR_PASSWORD' yourprefix_rentapp \
  -e "UPDATE User SET role='admin' WHERE email='your@email.com';"
```

4. Refresh the app — you should see the Admin panel

---

## Step 10: After Setup (Security)

Once the admin account is created, disable OTP bypass:

```bash
sed -i 's/BYPASS_PHONE_OTP="true"/BYPASS_PHONE_OTP="false"/' .env
```

Then restart the app in cPanel.

---

## Future Updates

For code changes:

```bash
# Local machine: make changes, build, commit
npm run build
git add .next/server ... (relevant changed files)
git commit -m "update: description"
git push origin master

# Server terminal:
git pull origin master
# Restart app in cPanel Node.js UI
```

---

## Known Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Turbopack symlink error during build | cPanel virtualenv creates symlinked node_modules | Build locally with `--webpack` flag |
| `prisma generate` fails on server | Postinstall script fails with symlinked node_modules | Use `npm install --ignore-scripts` then manual `prisma generate` |
| Antivirus blocks zip upload | ClamAV flags JS zip files | Push .next via git instead of uploading zip |
| `WhatsApp not connected` on signup | WhatsApp unavailable on shared hosting | Set `BYPASS_PHONE_OTP="true"` in .env |
| Prisma panic (timer has gone away) | OpenSSL version mismatch on server | Use MySQL direct query for admin setup instead |
| `@tailwindcss/postcss` not found | Incomplete npm install in virtualenv | Build locally and deploy pre-built .next |

---

## Important Notes

- **WhatsApp** will NOT work on shared cPanel hosting (requires Chromium/Puppeteer)
- **SQLite** is for local dev only — production always uses MySQL
- **node_modules** on server is a symlink to nodevenv — this is normal for cPanel
- **Build** must always happen locally on Windows, never on the server
- **`.next` folder** is tracked in git for deployment (unusual but necessary for cPanel)
