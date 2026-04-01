#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install tools
apt-get install -y postgresql-client git htop curl

# Add swap (2GB for t3.small memory relief)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Create deployment directory
mkdir -p /opt/waba
chown ubuntu:ubuntu /opt/waba

# Write database connection info for reference
cat > /opt/waba/db-info.txt <<EOF
DB_HOST=${db_host}
DB_NAME=${db_name}
DB_USER=${db_username}
DB_PASSWORD=${db_password}
EOF
chmod 600 /opt/waba/db-info.txt
chown ubuntu:ubuntu /opt/waba/db-info.txt

# Signal completion
touch /opt/waba/user-data-complete
