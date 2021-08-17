#!/bin/bash

function main() {
  sudo apt update -y
  sudo apt upgrade -y
  sudo timedatectl set-timezone Asia/Jakarta
  curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
  sudo apt-get install -y nodejs
  npm install -y
  npm audit fix -y
  sudo apt-get install build-essential -y
  sudo npm i pkg -g
  sudo npm i nexe -g
}

main