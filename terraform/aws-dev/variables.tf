variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "waba"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "vpc_id" {
  description = "VPC ID where resources will be created"
  type        = string
}

variable "ec2_subnet_id" {
  description = "Subnet ID for EC2 instance (public subnet recommended)"
  type        = string
}

variable "db_subnet_group_name" {
  description = "DB subnet group name for RDS (must have at least 2 subnets in different AZs)"
  type        = string
}

variable "key_pair_name" {
  description = "EC2 key pair name for SSH access"
  type        = string
}

variable "ssh_allowed_ips" {
  description = "List of CIDR blocks allowed to SSH and access admin UIs"
  type        = list(string)
  default     = ["0.0.0.0/0"] # CHANGE THIS to your IP for security
}

variable "ec2_instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.small"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "whatsapp_genesys"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "postgres"
}
