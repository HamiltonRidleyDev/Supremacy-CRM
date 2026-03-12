# Deploying Supremacy App to Linode (Ubuntu)

## Prerequisites
- Ubuntu server on Linode with SSH access
- Git installed on server

## Step 1: Install Docker

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Log out and back in for the group change to take effect
```

## Step 2: Get the code onto the server

```bash
git clone https://github.com/dkemp-io/supremacy-app.git
cd supremacy-app
```

## Step 3: Configure environment

```bash
cp .env.example .env
nano .env   # Fill in all values
```

Required values:
- `ANTHROPIC_API_KEY` — your Claude API key
- `JWT_SECRET` — generate with: `openssl rand -hex 32`
- `ZIVVY_*` — Zivvy login credentials
- `MM_*` — Market Muscles API tokens

## Step 4: Build and run

```bash
docker compose up -d --build
```

The app will be running on port 3000. Visit `http://your-linode-ip:3000` to verify.

First run auto-seeds the database with demo data.

## Step 5 (Optional): Domain + SSL with nginx

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/supremacy`:
```nginx
server {
    listen 80;
    server_name app.supremacyjj.com;  # your domain

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it:
```bash
sudo ln -s /etc/nginx/sites-available/supremacy /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.supremacyjj.com
```

## Useful commands

```bash
# View logs
docker compose logs -f

# Restart after code changes
git pull && docker compose up -d --build

# Stop the app
docker compose down

# Stop and wipe the database (fresh start)
docker compose down -v

# Shell into the running container
docker compose exec supremacy sh

# Back up the database
docker compose cp supremacy:/app/data/supremacy.db ./backup-$(date +%Y%m%d).db
```

## Updating

```bash
cd supremacy-app
git pull
docker compose up -d --build
```

The database persists across rebuilds (Docker volume). Only the app code is rebuilt.

## Notes
- SQLite database persisted in Docker volume `supremacy-data`
- Database auto-seeds demo data on first run
- App runs on port 3000, map to any port in docker-compose.yml
- PWA installable — users can "Add to Home Screen" on mobile
- Sessions last 30 days, auto-refresh on use
