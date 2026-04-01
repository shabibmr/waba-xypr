#!/bin/bash
# Script to install ngrok on Ubuntu x86_64

echo "Installing ngrok..."

# Add ngrok GPG key
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null

# Add ngrok repository
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list

# Update and install
sudo apt update
sudo apt install ngrok -y

echo "------------------------------------------------------------"
if which ngrok > /dev/null; then
    echo "✅ ngrok successfully installed!"
    echo "Next steps:"
    echo "1. Run: ngrok config add-authtoken <YOUR_AUTHTOKEN>"
    echo "2. Run: ./setup-ngrok.sh"
else
    echo "❌ Installation failed."
fi
echo "------------------------------------------------------------"
