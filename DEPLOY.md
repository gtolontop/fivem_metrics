# Déploiement sur Railway

## Prérequis Railway

1. **Redis** (gratuit sur Railway)
2. **App principale** (1 instance)
3. **Workers** (10-50 instances)

## Architecture

```
┌─────────────────────────────────┐
│         APP PRINCIPALE          │
│  - Next.js UI                   │
│  - Cache 32K serveurs           │
│  - Stocke les IPs               │
│  URL: ton-app.railway.app       │
└───────────────┬─────────────────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
┌───────┐  ┌───────┐  ┌───────┐
│Worker1│  │Worker2│  │WorkerN│
│ IP: A │  │ IP: B │  │ IP: X │
└───────┘  └───────┘  └───────┘
```

## Étape 1: Créer Redis

1. Dans Railway: "New Project" → "Provision Redis"
2. Clique sur Redis → Variables
3. Copie `REDIS_URL` (genre `redis://default:xxx@xxx.railway.app:6379`)

## Étape 2: Déployer l'App Principale

1. Dans le même projet: "New Service" → GitHub repo
2. Railway va auto-détecter le Dockerfile
3. Variables d'environnement:
   ```
   REDIS_URL=redis://default:xxx@xxx.railway.app:6379
   ```
4. Note l'URL: `https://ton-app.railway.app`

## Étape 3: Déployer les Workers

### Option A: Via Railway (recommandé)

Pour chaque worker:
1. Dans le même projet, "New Service" → "Docker"
2. Utilise `Dockerfile.worker`
3. Variables d'environnement:
   ```
   API_BASE=https://ton-app.railway.app
   WORKER_ID=worker-1  (optionnel, auto-généré sinon)
   ```
4. Répète pour créer 10-50 workers

### Option B: Via CLI (pour scale rapide)

```bash
# Installe Railway CLI
npm i -g @railway/cli

# Login
railway login

# Pour chaque worker
for i in {1..50}; do
  railway run --service worker-$i npm run worker
done
```

## Comment ça marche

1. **App principale** fetch 32K serveurs FiveM au démarrage
2. **Workers** appellent `/api/worker/get-batch` pour obtenir des serveurs à traiter
3. **Workers** fetch les vraies IPs depuis FiveM API (chaque worker a une IP différente = pas de rate limit)
4. **Workers** POST les IPs à `/api/worker/submit-ips`
5. **App principale** stocke les IPs et les utilise pour scanner les ressources

## Temps estimé

- 1 worker: ~150 IPs avant rate limit → 32K IPs en ~200 runs
- 50 workers: ~7500 IPs par run → 32K IPs en ~5 runs (quelques minutes!)

## Endpoints

| Endpoint | Description |
|----------|-------------|
| GET `/api/data` | Liste des serveurs (UI) |
| GET `/api/resources` | Liste des ressources |
| GET `/api/scan-fast` | Scan direct des serveurs (utilise IPs cachées) |
| GET `/api/worker/get-batch` | Distribue le travail aux workers |
| POST `/api/worker/submit-ips` | Reçoit les IPs des workers |

## Monitoring

Vérifie le progrès:
```bash
curl https://ton-app.railway.app/api/worker/get-batch
# {"processed": 15000, "total": 32000, "progress": 47}
```
