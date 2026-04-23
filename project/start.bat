@echo off
echo 🚀 Starting Lectomate Application...
echo.

echo 📦 Starting Backend Server...
cd server
start "Backend Server" cmd /k "node simple-server.js"
timeout /t 3 /nobreak > nul

echo 🌐 Starting Frontend...
cd ..
start "Frontend" cmd /k "npm run dev"

echo.
echo ✅ Lectomate is starting up!
echo 📱 Frontend: http://localhost:5173
echo 🔧 Backend: http://localhost:3001
echo.
echo 🎉 Open your browser and go to: http://localhost:5173
echo.
pause
