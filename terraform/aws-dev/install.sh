#!/bin/bash
set -e

# WABA AWS CLI & Terraform Installation Script
# Supports: macOS, Linux (Ubuntu/Debian, RHEL/CentOS)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            if [[ "$ID" == "ubuntu" ]] || [[ "$ID" == "debian" ]]; then
                OS="ubuntu"
            elif [[ "$ID" == "rhel" ]] || [[ "$ID" == "centos" ]] || [[ "$ID" == "fedora" ]]; then
                OS="rhel"
            else
                OS="linux"
            fi
        else
            OS="linux"
        fi
    else
        OS="unknown"
    fi

    log_info "Detected OS: $OS"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install AWS CLI
install_aws_cli() {
    log_info "Installing AWS CLI..."

    if command_exists aws; then
        CURRENT_VERSION=$(aws --version 2>&1 | awk '{print $1}' | cut -d/ -f2)
        log_warn "AWS CLI already installed (version: $CURRENT_VERSION)"
        read -p "Do you want to upgrade? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Skipping AWS CLI installation"
            return 0
        fi
    fi

    case $OS in
        macos)
            if command_exists brew; then
                log_info "Installing via Homebrew..."
                brew install awscli
            else
                log_info "Downloading AWS CLI installer..."
                curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "/tmp/AWSCLIV2.pkg"
                log_info "Installing AWS CLI (requires sudo)..."
                sudo installer -pkg /tmp/AWSCLIV2.pkg -target /
                rm /tmp/AWSCLIV2.pkg
            fi
            ;;

        ubuntu)
            log_info "Downloading AWS CLI for Linux..."
            cd /tmp
            curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"

            if ! command_exists unzip; then
                log_info "Installing unzip..."
                sudo apt-get update
                sudo apt-get install -y unzip
            fi

            unzip -o awscliv2.zip
            log_info "Installing AWS CLI (requires sudo)..."
            sudo ./aws/install --update
            rm -rf aws awscliv2.zip
            ;;

        rhel)
            log_info "Downloading AWS CLI for Linux..."
            cd /tmp
            curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"

            if ! command_exists unzip; then
                log_info "Installing unzip..."
                sudo yum install -y unzip
            fi

            unzip -o awscliv2.zip
            log_info "Installing AWS CLI (requires sudo)..."
            sudo ./aws/install --update
            rm -rf aws awscliv2.zip
            ;;

        *)
            log_error "Unsupported OS for automatic installation"
            log_info "Please install AWS CLI manually from: https://aws.amazon.com/cli/"
            exit 1
            ;;
    esac

    # Verify installation
    if command_exists aws; then
        AWS_VERSION=$(aws --version)
        log_info "✅ AWS CLI installed successfully: $AWS_VERSION"
    else
        log_error "AWS CLI installation failed"
        exit 1
    fi
}

# Install Terraform
install_terraform() {
    log_info "Installing Terraform..."

    if command_exists terraform; then
        CURRENT_VERSION=$(terraform --version | head -n1 | awk '{print $2}')
        log_warn "Terraform already installed (version: $CURRENT_VERSION)"
        read -p "Do you want to upgrade? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Skipping Terraform installation"
            return 0
        fi
    fi

    TERRAFORM_VERSION="1.7.4"

    case $OS in
        macos)
            if command_exists brew; then
                log_info "Installing via Homebrew..."
                brew tap hashicorp/tap
                brew install hashicorp/tap/terraform
            else
                log_info "Downloading Terraform..."
                cd /tmp
                curl -LO "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_darwin_amd64.zip"
                unzip -o terraform_${TERRAFORM_VERSION}_darwin_amd64.zip
                sudo mv terraform /usr/local/bin/
                sudo chmod +x /usr/local/bin/terraform
                rm terraform_${TERRAFORM_VERSION}_darwin_amd64.zip
            fi
            ;;

        ubuntu)
            log_info "Adding HashiCorp GPG key..."
            wget -O- https://apt.releases.hashicorp.com/gpg | \
                gpg --dearmor | \
                sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg > /dev/null

            log_info "Adding HashiCorp repository..."
            echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] \
                https://apt.releases.hashicorp.com $(lsb_release -cs) main" | \
                sudo tee /etc/apt/sources.list.d/hashicorp.list

            log_info "Installing Terraform..."
            sudo apt-get update
            sudo apt-get install -y terraform
            ;;

        rhel)
            log_info "Adding HashiCorp repository..."
            sudo yum install -y yum-utils
            sudo yum-config-manager --add-repo https://rpm.releases.hashicorp.com/RHEL/hashicorp.repo

            log_info "Installing Terraform..."
            sudo yum install -y terraform
            ;;

        *)
            log_error "Unsupported OS for automatic installation"
            log_info "Please install Terraform manually from: https://www.terraform.io/downloads"
            exit 1
            ;;
    esac

    # Verify installation
    if command_exists terraform; then
        TERRAFORM_VERSION=$(terraform --version | head -n1)
        log_info "✅ Terraform installed successfully: $TERRAFORM_VERSION"
    else
        log_error "Terraform installation failed"
        exit 1
    fi
}

# Configure AWS CLI
configure_aws() {
    log_info "Configuring AWS CLI..."

    if [ -f ~/.aws/credentials ]; then
        log_warn "AWS credentials already configured"
        read -p "Do you want to reconfigure? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Skipping AWS configuration"
            return 0
        fi
    fi

    echo ""
    log_info "Please enter your AWS credentials"
    log_info "Get them from: https://console.aws.amazon.com/iam/"
    echo ""

    aws configure

    # Test connection
    log_info "Testing AWS connection..."
    if aws sts get-caller-identity > /dev/null 2>&1; then
        log_info "✅ AWS CLI configured successfully"
        aws sts get-caller-identity
    else
        log_error "AWS CLI configuration failed - please check your credentials"
        exit 1
    fi
}

# Install additional tools
install_extras() {
    log_info "Installing additional tools..."

    case $OS in
        macos)
            if command_exists brew; then
                if ! command_exists jq; then
                    log_info "Installing jq..."
                    brew install jq
                fi
            fi
            ;;

        ubuntu)
            log_info "Installing postgresql-client and jq..."
            sudo apt-get update
            sudo apt-get install -y postgresql-client jq curl
            ;;

        rhel)
            log_info "Installing postgresql and jq..."
            sudo yum install -y postgresql jq curl
            ;;
    esac
}

# Main installation flow
main() {
    echo ""
    log_info "======================================"
    log_info "WABA AWS Infrastructure Setup"
    log_info "======================================"
    echo ""

    detect_os

    # Install AWS CLI
    install_aws_cli

    # Install Terraform
    install_terraform

    # Install extras
    install_extras

    # Configure AWS
    echo ""
    read -p "Do you want to configure AWS CLI now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        configure_aws
    else
        log_info "You can configure AWS CLI later with: aws configure"
    fi

    # Summary
    echo ""
    log_info "======================================"
    log_info "Installation Summary"
    log_info "======================================"
    echo ""

    if command_exists aws; then
        echo "✅ AWS CLI: $(aws --version)"
    else
        echo "❌ AWS CLI: Not installed"
    fi

    if command_exists terraform; then
        echo "✅ Terraform: $(terraform --version | head -n1)"
    else
        echo "❌ Terraform: Not installed"
    fi

    if [ -f ~/.aws/credentials ]; then
        echo "✅ AWS Configured: Yes"
        echo "   Account: $(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo 'Unable to verify')"
    else
        echo "⚠️  AWS Configured: No"
    fi

    echo ""
    log_info "======================================"
    log_info "Next Steps"
    log_info "======================================"
    echo ""
    echo "1. Configure AWS CLI (if not done):"
    echo "   $ aws configure"
    echo ""
    echo "2. Run the prerequisite setup script:"
    echo "   $ ./setup-prerequisites.sh"
    echo ""
    echo "3. Deploy infrastructure:"
    echo "   $ terraform init"
    echo "   $ terraform plan"
    echo "   $ terraform apply"
    echo ""

    log_info "✅ Installation complete!"
}

# Run main
main
