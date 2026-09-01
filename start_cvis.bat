@echo off
echo Starting CVIS Services on Windows...

:: Navigate to the directory where this script is located
cd /d "%~dp0"

echo Starting CVIS Backend in a new terminal...
start cmd /k "cd backend && call venv\Scripts\activate && python main.py"

echo Starting CVIS Frontend in a new terminal...
start cmd /k "cd frontend && npm run dev"

echo Starting CVIS Simulator in a new terminal...
start cmd /k "cd backend && call venv\Scripts\activate && python simulator.py"

echo All services have been started!

echo Waiting for servers to start before opening browser...
timeout /t 5 /nobreak > NUL

echo Opening CVIS browser tabs...
start http://localhost:3000/driver
start http://localhost:3000/noc
start http://localhost:3000/admin
start http://localhost:3000/alphamobile

pause
