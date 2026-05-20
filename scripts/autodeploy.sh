#!/bin/bash

# Navigate to the project directory on the server
cd ~/RecruitScout-Master || exit

# Fetch remote changes from GitHub silently
git fetch origin main >/dev/null 2>&1

# Check if there are changes between local and remote
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "[$(date)] New code detected. Pulling and rebuilding..."
    
    # Pull the latest code
    git pull origin main
    
    # Rebuild the Docker image
    docker build -t recruitscout-dashboard .
    
    # Stop and remove the existing container (ignore error if it doesn't exist)
    docker rm -f dashboard || true
    
    # Start the new container
    docker run -d -p 80:80 --name dashboard --restart unless-stopped recruitscout-dashboard
    
    echo "[$(date)] Deployment successful."
else
    # Commenting this out so the log doesn't fill up every 5 minutes
    # echo "Already up-to-date. No deployment needed."
    :
fi
