@echo off
echo Verifying TypeScript migration...
echo.

cd c:\hehe\frontend
npx tsc --noEmit

if %ERRORLEVEL% EQU 0 (
    echo.
    echo TypeScript migration validation successful!
    echo Your project has been successfully migrated to TypeScript.
) else (
    echo.
    echo TypeScript migration needs some more attention.
    echo Please fix the errors above and run this script again.
)

echo.
echo Note: This only checks for TypeScript compile errors, not runtime issues.
echo Please test your application thoroughly after fixing any remaining type errors.
pause
