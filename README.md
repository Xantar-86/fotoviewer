# FeetBusiness Studio v2

Een ultra-moderne web applicatie voor content creators op platforms zoals FeetFinder, OnlyFans en Fansly.

## Functies

- **Foto Editor** — EXIF verwijderen, beeldverbetering, watermerken, bijsnijden, vervagen, platform-formaten
- **AI Studio** — Claude AI integratie voor foto-analyse, titels, sessie-ideeën en antwoordsjablonen (in het Nederlands)
- **Business Dashboard** — Inkomen bijhouden, bestellingen beheren, prijscalculator
- **Donker glassmorphism UI** — Ultra-moderne interface met paarse accenten

## Technologie

| Onderdeel | Technologie |
|-----------|-------------|
| Frontend  | Next.js 15, TypeScript, Tailwind CSS, Framer Motion |
| Backend   | FastAPI, Python 3.11, SQLAlchemy |
| AI        | Anthropic Claude (claude-opus-4-6) |
| Database  | PostgreSQL (productie) / SQLite (lokaal) |
| Deploy    | Railway |

## Lokaal draaien

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend draait op http://localhost:8000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend draait op http://localhost:3000

## Deployen naar Railway

### 1. Repository aanmaken

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/jouw-gebruikersnaam/feetbusiness-studio.git
git push -u origin main
```

### 2. Railway project aanmaken

1. Ga naar [railway.app](https://railway.app) en log in
2. Klik **New Project** → **Deploy from GitHub repo**
3. Selecteer jouw repository

### 3. Backend service instellen

1. Klik **Add Service** → **GitHub Repo**
2. Selecteer de repo en kies de `backend/` map als root directory
3. Railway detecteert automatisch de Dockerfile
4. Voeg omgevingsvariabelen toe:
   - `DATABASE_URL` — Klik op **Add Plugin** → PostgreSQL, kopieer de URL
5. De backend deployt automatisch

### 4. Frontend service instellen

1. Klik **Add Service** → **GitHub Repo**
2. Selecteer dezelfde repo, root directory: `frontend/`
3. Voeg omgevingsvariabelen toe:
   - `NEXT_PUBLIC_API_URL` — De URL van je backend service (bijv. `https://backend-xxxxx.railway.app`)
4. De frontend deployt automatisch

### 5. Domeinen koppelen

In elke service: **Settings** → **Networking** → **Generate Domain** voor een Railway subdomain.

## Omgevingsvariabelen

### Backend (`.env` lokaal)

```env
DATABASE_URL=sqlite:///./feetbusiness.db
```

### Frontend (`.env.local` lokaal)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## API Documentatie

Na het starten van de backend, bekijk de interactieve docs:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Anthropic API Sleutel

Voor de AI Studio functies heb je een Anthropic API sleutel nodig:

1. Maak een account aan op [console.anthropic.com](https://console.anthropic.com)
2. Ga naar **API Keys** en maak een nieuwe sleutel aan
3. Vul de sleutel in via **Instellingen** in de app (wordt lokaal opgeslagen)

## Structuur

```
feetbusiness - webapp/
├── backend/
│   ├── main.py              # FastAPI applicatie met alle routes
│   ├── database.py          # SQLAlchemy modellen & database setup
│   ├── image_processing.py  # Pillow/OpenCV beeldverwerking
│   ├── ai_service.py        # Anthropic Claude AI integratie
│   ├── requirements.txt
│   ├── Dockerfile
│   └── railway.json
├── frontend/
│   ├── app/
│   │   ├── layout.tsx       # Root layout met sidebar
│   │   ├── page.tsx         # Dashboard
│   │   ├── editor/page.tsx  # Foto editor
│   │   ├── ai/page.tsx      # AI Studio
│   │   ├── business/page.tsx# Business dashboard
│   │   └── settings/page.tsx# Instellingen
│   ├── components/
│   │   └── Sidebar.tsx      # Navigatie sidebar
│   ├── lib/
│   │   └── api.ts           # API client (axios)
│   ├── Dockerfile
│   └── railway.json
├── railway.toml
├── .gitignore
└── README.md
```
