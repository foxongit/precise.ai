@echo off
echo Removing old JavaScript files that have been migrated to TypeScript...

del /q "c:\hehe\frontend\src\main.jsx"
del /q "c:\hehe\frontend\src\components\Sidebar.jsx"
del /q "c:\hehe\frontend\src\components\Home.jsx"
del /q "c:\hehe\frontend\src\components\DocumentViewer.jsx"
del /q "c:\hehe\frontend\src\components\Dashboard.jsx"
del /q "c:\hehe\frontend\src\components\Auth.jsx"
del /q "c:\hehe\frontend\src\components\ActivityLog.jsx"
del /q "c:\hehe\frontend\src\App.jsx"
del /q "c:\hehe\frontend\src\services\api.js"
del /q "c:\hehe\frontend\src\lib\supabase.js"

echo Cleanup complete!
pause
