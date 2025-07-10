# Gitignore Configuration

This project has multiple `.gitignore` files to ensure sensitive data and unnecessary files are not committed to the repository.

## Files Structure

- `/.gitignore` - Root level gitignore for the entire project
- `/frontend/.gitignore` - Frontend specific gitignore (React/TypeScript/Vite)
- `/FinalRag/.gitignore` - Backend specific gitignore (Python/FastAPI)

## Environment Variables

### Frontend (`/frontend/.env.local`)
Create this file and add your actual values:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_google_gemini_api_key
```

### Backend (`/FinalRag/.env`)
Create this file and add your actual values:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_google_gemini_api_key
DATABASE_URL=your_database_connection_string
```

## Security Notes

1. **Never commit `.env*` files** - They contain sensitive API keys
2. **API Keys** - Store all API keys in environment variables, never hardcode them
3. **Database files** - SQLite and ChromaDB files are excluded from version control
4. **Build artifacts** - All build outputs are ignored
5. **Node modules** - Dependencies are rebuilt from package.json

## Files Currently Ignored

### Sensitive Data
- `.env*` files
- `*.key` files
- `credentials/` directory
- `secrets/` directory

### Database Files
- `*.sqlite3`
- `chroma_db/` contents
- Local database files

### Build Artifacts
- `node_modules/`
- `dist/`
- `build/`
- `__pycache__/`

### Development Files
- `.vscode/` (except extensions.json)
- `.idea/`
- `*.log`
- Temporary files

## Best Practices

1. Use `.env.example` files to document required environment variables
2. Never commit actual credentials or API keys
3. Use different environment files for different stages (development, staging, production)
4. Regularly review and update gitignore files as the project evolves
