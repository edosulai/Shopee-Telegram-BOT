#!/bin/bash

sudo apt update -y
sudo apt upgrade -y
sudo timedatectl set-timezone Asia/Jakarta
curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -y
npm audit fix -y
sudo npm install nodemon -g
sudo npm install forever -g
sudo git config credential.helper store