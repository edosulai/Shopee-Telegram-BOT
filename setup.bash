#!/bin/bash

sudo apt update -y
sudo apt upgrade -y
sudo timedatectl set-timezone Asia/Jakarta
sudo apt install ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils
curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -y
npm audit fix -y
sudo npm install nodemon -g
git config --global user.email "ngufeel@gmail.com"
git config --global user.name "edosulai"
sudo git config credential.helper store