output "ec2_public_ip" {
  description = "Elastic IP address of EC2 instance"
  value       = aws_eip.app_server.public_ip
}

output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.app_server.id
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_address" {
  description = "RDS PostgreSQL address (without port)"
  value       = aws_db_instance.postgres.address
}

output "db_name" {
  description = "Database name"
  value       = aws_db_instance.postgres.db_name
}

output "db_username" {
  description = "Database username"
  value       = aws_db_instance.postgres.username
  sensitive   = true
}

output "db_password" {
  description = "Database password (sensitive)"
  value       = random_password.db_password.result
  sensitive   = true
}

output "ssh_command" {
  description = "SSH command to connect to EC2"
  value       = "ssh -i ~/.ssh/${var.key_pair_name}.pem ubuntu@${aws_eip.app_server.public_ip}"
}

output "service_urls" {
  description = "Service access URLs"
  value = {
    api_gateway      = "http://${aws_eip.app_server.public_ip}:3000"
    agent_portal     = "http://${aws_eip.app_server.public_ip}:3014"
    admin_dashboard  = "http://${aws_eip.app_server.public_ip}:3006"
    rabbitmq_ui      = "http://${aws_eip.app_server.public_ip}:15672"
    minio_console    = "http://${aws_eip.app_server.public_ip}:9001"
  }
}

output "env_file_snippet" {
  description = "Environment variables for .env file"
  value = <<-EOT
# RDS Database
DB_HOST=${aws_db_instance.postgres.address}
DB_PORT=5432
DB_USER=${aws_db_instance.postgres.username}
DB_PASSWORD=${random_password.db_password.result}
DB_NAME=${aws_db_instance.postgres.db_name}

# Public URLs
PUBLIC_URL=http://${aws_eip.app_server.public_ip}
WEBHOOK_BASE_URL=http://${aws_eip.app_server.public_ip}
EOT
  sensitive = true
}
