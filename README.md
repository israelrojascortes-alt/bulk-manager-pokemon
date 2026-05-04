# ⚡ Bulk Manager — Pokémon TCG

App mobile para gestionar cartas Pokémon bulk: escanear, inventariar, armar lotes y registrar ventas.

## Deploy en Vercel (5 minutos, gratis)

### Requisitos
- Cuenta en [github.com](https://github.com) (gratis)
- Cuenta en [vercel.com](https://vercel.com) (gratis)
- API Key de Anthropic: [console.anthropic.com](https://console.anthropic.com)

---

### Paso 1 — Sube el proyecto a GitHub

1. Ve a [github.com/new](https://github.com/new)
2. Nombre: `bulk-manager-pokemon`
3. Privado ✓ → **Create repository**
4. Sube los archivos de este proyecto:
   ```bash
   git init
   git add .
   git commit -m "init"
   git remote add origin https://github.com/TU_USUARIO/bulk-manager-pokemon.git
   git push -u origin main
   ```

### Paso 2 — Despliega en Vercel

1. Ve a [vercel.com/new](https://vercel.com/new)
2. **Import** → selecciona `bulk-manager-pokemon`
3. Framework: **Next.js** (auto-detectado)
4. Click **Deploy** — espera ~2 minutos

### Paso 3 — Agrega la API Key

1. En Vercel → tu proyecto → **Settings** → **Environment Variables**
2. Agrega:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-tu-api-key-aqui`
3. **Save** → luego **Deployments** → **Redeploy**

### Paso 4 — Abre en tu celular

Tu app estará en: `https://bulk-manager-pokemon.vercel.app`

- Ábrela en Chrome/Samsung Browser
- Toca ⋮ → **"Añadir a pantalla de inicio"**
- ¡Ya tienes la app instalada como si fuera nativa! 📱

---

## Desarrollo local

```bash
npm install
cp .env.local.example .env.local
# Edita .env.local con tu API key
npm run dev
# Abre http://localhost:3000
```

---

## Estructura

```
bulk-manager/
├── pages/
│   ├── index.js          ← App principal (React)
│   └── api/
│       └── claude.js     ← Proxy Anthropic (server-side)
├── styles/
│   └── globals.css
├── package.json
├── .env.local.example
└── .gitignore
```

## Tecnologías

- **Next.js 14** — Framework React
- **Anthropic Claude** — Identificación de cartas + precios
- **apitcg.com** — Base de datos Pokémon TCG (powered by TCGMatch)
- **localStorage** — Persistencia de datos en el dispositivo
- **Vercel** — Hosting gratuito
