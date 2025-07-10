# 🚀 Deploy RAG API on Render

## 📋 Prerequisites

1. **GitHub Repository** - Push your code to GitHub
2. **Render Account** - Sign up at [render.com](https://render.com)
3. **Supabase Account** - For database and storage

## 🛠️ Deployment Steps

### 1. **Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit - RAG API"
git branch -M main
git remote add origin https://github.com/yourusername/your-repo-name.git
git push -u origin main
```

### 2. **Create New Web Service on Render**

1. Go to [render.com](https://render.com) and sign in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Use these settings:

**Basic Settings:**
- **Name**: `rag-document-api`
- **Environment**: `Python 3`
- **Build Command**: `./build.sh`
- **Start Command**: `./start.sh`

**Advanced Settings:**
- **Python Version**: `3.11.0`

### 3. **Environment Variables**

Add these environment variables in Render dashboard:

```
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_key_here
SUPABASE_BUCKET=documents
```

### 4. **Deploy**

Click **"Create Web Service"** - Render will automatically:
- Install dependencies from `requirements.txt`
- Run the build script
- Start your application
- Provide you with a URL like: `https://your-app-name.onrender.com`

## 🔧 Files Created for Render

### `build.sh` - Build Script
```bash
#!/usr/bin/env bash
pip install -r requirements.txt
mkdir -p data/uploads data/chroma_db data/mappings
```

### `start.sh` - Start Script  
```bash
#!/usr/bin/env bash
python -m uvicorn src.main:app --host 0.0.0.0 --port $PORT
```

### `Procfile` - Process File
```
web: python -m uvicorn src.main:app --host 0.0.0.0 --port $PORT
```

### `render.yaml` - Render Configuration
```yaml
services:
  - type: web
    name: rag-document-api
    env: python
    buildCommand: "./build.sh"
    startCommand: "./start.sh"
```

## ✅ After Deployment

Your API will be available at:
- **API**: `https://your-app-name.onrender.com`
- **Docs**: `https://your-app-name.onrender.com/docs`
- **Health**: `https://your-app-name.onrender.com/health`

## 🔍 Testing Deployment

```bash
# Test health endpoint
curl https://your-app-name.onrender.com/health

# Expected response:
{"status":"healthy","timestamp":"2025-07-03T..."}
```

## 📝 Important Notes

1. **Free Tier**: Render free tier sleeps after 15 minutes of inactivity
2. **Storage**: Files uploaded will be ephemeral (lost on restart)
3. **Database**: Use Supabase for persistent storage
4. **Environment**: Make sure all environment variables are set

## 🚨 Troubleshooting

### Build Fails?
- Check `requirements.txt` for missing dependencies
- Verify Python version compatibility

### App Won't Start?
- Check environment variables are set correctly
- Verify `PORT` environment variable usage

### Import Errors?
- Ensure all `__init__.py` files are included
- Check file paths and imports

## 🎯 Success!

Once deployed, your RAG Document Processing API will be live and accessible worldwide! 🌍
