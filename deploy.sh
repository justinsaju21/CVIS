#!/usr/bin/env bash
set -e

echo '>>> [1/5] Pulling latest changes from git...'
cd /home/justin/CVIS
git pull

echo '>>> [2/6] Restarting cvis-backend...'
pm2 restart cvis-backend

echo '>>> [3/6] Building cvis-frontend...'
cd /home/justin/CVIS/frontend
npm run build

echo '>>> [4/6] Restarting cvis-frontend...'
pm2 restart cvis-frontend

echo '>>> [5/6] Restarting cvis-replay...'
pm2 restart cvis-replay

echo '>>> [6/6] Saving PM2 state...'
pm2 save

echo ''
echo '===================================='
echo '  CVIS Update & Deployment Complete! '
echo '===================================='
pm2 status
