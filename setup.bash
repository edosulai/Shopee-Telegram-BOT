#!/bin/bash

sudo apt update -y
sudo apt upgrade -y
sudo timedatectl set-timezone Asia/Jakarta
curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -y
npm audit fix -y
sudo npm install -g nodemon