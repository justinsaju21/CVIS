#!/bin/bash
# Start CVIS Services on Mac

# Navigate to the directory where this script is located
cd "$(dirname "$0")"
PROJECT_ROOT=$(pwd)

echo "Starting CVIS Backend in a new terminal window..."
osascript -e "tell app \"Terminal\" to do script \"cd \\\"$PROJECT_ROOT/backend\\\" && source venv/bin/activate && python main.py\""

echo "Starting CVIS Frontend in a new terminal window..."
osascript -e "tell app \"Terminal\" to do script \"cd \\\"$PROJECT_ROOT/frontend\\\" && npm run dev\""

echo "Starting CVIS Simulator in a new terminal window..."
osascript -e "tell app \"Terminal\" to do script \"cd \\\"$PROJECT_ROOT/backend\\\" && source venv/bin/activate && python simulator.py\""

echo "All services have been started!"

echo "Waiting for servers to start before opening browser..."
sleep 5

echo "Opening CVIS browser tabs..."
open http://localhost:3000/driver
open http://localhost:3000/noc
open http://localhost:3000/admin
open http://localhost:3000/alphamobile
