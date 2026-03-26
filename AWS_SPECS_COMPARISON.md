# AWS Deployment Specs Comparison

Choose the right configuration for your needs.

## Quick Comparison

| Aspect | Development/Testing | Production |
|--------|-------------------|------------|
| **Monthly Cost** | **~$35** | **~$127** |
| **RDS Instance** | db.t4g.micro (1GB) | db.t3.small (2GB) |
| **EC2 Instance** | t3.small (2GB) | t3.large (8GB) |
| **Multi-AZ** | No | Yes |
| **Backups** | 1 day | 7 days |
| **SSL/TLS** | Optional | Required |
| **Recommended For** | Testing, dev | Production traffic |

## Detailed Specs

### Development/Testing Configuration

**Best for**: Testing, development, demos, PoC

#### RDS PostgreSQL
- **Instance Class**: `db.t4g.micro`
- **vCPU**: 2 (ARM-based)
- **Memory**: 1GB
- **Storage**: 20GB gp3
- **Multi-AZ**: No (single AZ)
- **Backup Retention**: 1 day
- **Cost**: ~$13/month

#### EC2 Instance
- **Instance Type**: `t3.small`
- **vCPU**: 2
- **Memory**: 2GB
- **Storage**: 20GB gp3 EBS
- **Cost**: ~$15/month

#### Infrastructure (on EC2)
- Redis: 256MB memory limit
- RabbitMQ: 512MB memory limit
- MinIO: Standard limits

#### Application Settings
- `NODE_ENV=development`
- `LOG_LEVEL=debug`
- Dev login enabled
- Debug features enabled

**Total Cost**: ~$35/month

**Limitations**:
- Handle low to moderate traffic
- Single point of failure (no Multi-AZ)
- Limited concurrent connections
- May experience memory pressure under load

---

### Production Configuration

**Best for**: Production workloads, high availability

#### RDS PostgreSQL
- **Instance Class**: `db.t3.small` or `db.t3.medium`
- **vCPU**: 2-4
- **Memory**: 2-4GB
- **Storage**: 20GB gp3 (autoscaling to 100GB)
- **Multi-AZ**: Yes (automatic failover)
- **Backup Retention**: 7 days
- **Encryption**: At rest + in transit
- **Cost**: ~$50-90/month

#### EC2 Instance
- **Instance Type**: `t3.large` or larger
- **vCPU**: 2
- **Memory**: 8GB
- **Storage**: 30GB gp3 EBS
- **Cost**: ~$60/month

#### Infrastructure (on EC2)
- Redis: Unlimited (within container limits)
- RabbitMQ: Production-grade settings
- MinIO: Full capacity

#### Application Settings
- `NODE_ENV=production`
- `LOG_LEVEL=info`
- Production optimizations
- SSL/TLS required

**Total Cost**: ~$127/month (base configuration)

**Benefits**:
- High availability with Multi-AZ
- Auto-failover for database
- Handle production traffic
- Better performance
- Enhanced security

---

## Deployment Files

| Configuration | Docker Compose | Deploy Script | Guide |
|--------------|----------------|---------------|-------|
| **Development** | `docker-compose.aws-dev.yml` | `scripts/deploy-aws-dev.sh` | `AWS_DEV_DEPLOYMENT.md` |
| **Production** | `docker-compose.aws.yml` | `scripts/deploy-aws.sh` | `AWS_DEPLOYMENT_GUIDE.md` |

## When to Use Each

### Use Development Specs When:
- ✅ Testing new features
- ✅ Development environment
- ✅ Learning/training
- ✅ Demo/PoC
- ✅ CI/CD testing
- ✅ Budget constraints
- ✅ Temporary deployments

### Use Production Specs When:
- ✅ Handling real customer traffic
- ✅ Need high availability (99.95%+)
- ✅ Require automatic failover
- ✅ Compliance requirements
- ✅ 24/7 operation
- ✅ Multiple tenants
- ✅ Performance critical

## Performance Expectations

### Development Configuration
- **Concurrent Users**: 5-20
- **Messages/min**: 100-500
- **Database Connections**: 20-50
- **Response Time**: <500ms (light load)
- **Uptime SLA**: None (single AZ)

### Production Configuration
- **Concurrent Users**: 100-500+
- **Messages/min**: 1000-5000+
- **Database Connections**: 100-300
- **Response Time**: <200ms (normal load)
- **Uptime SLA**: 99.95% (Multi-AZ)

## Migration Path

### From Development to Production

1. **Backup Development Data**
   ```bash
   ./scripts/manage-aws.sh db-backup
   ./scripts/manage-aws.sh backup
   ```

2. **Create Production RDS** (new instance)
   ```bash
   aws rds create-db-instance \
     --db-instance-identifier waba-postgres-prod \
     --db-instance-class db.t3.small \
     --multi-az \
     ...
   ```

3. **Restore Data to Production RDS**
   ```bash
   PGPASSWORD=$PROD_PASSWORD pg_restore \
     -h prod-endpoint \
     -U postgres \
     -d whatsapp_genesys \
     backup-file.dump
   ```

4. **Upgrade EC2 Instance**
   - Stop instance
   - Change instance type to t3.large
   - Start instance

5. **Update Configuration**
   ```bash
   # Update .env
   NODE_ENV=production
   LOG_LEVEL=info
   DB_HOST=prod-rds-endpoint
   ```

6. **Deploy Production Stack**
   ```bash
   ./scripts/deploy-aws.sh
   ```

### From Production to Development (testing)

1. **Create Snapshot of Production RDS**
   ```bash
   aws rds create-db-snapshot \
     --db-instance-identifier waba-postgres-prod \
     --db-snapshot-identifier prod-snapshot-$(date +%Y%m%d)
   ```

2. **Restore Snapshot to Dev RDS**
   ```bash
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier waba-postgres-dev-test \
     --db-snapshot-identifier prod-snapshot-20250326 \
     --db-instance-class db.t4g.micro \
     --no-multi-az
   ```

3. **Deploy Dev Stack** with production data

## Cost Optimization Strategies

### Development Environment
1. **Stop when not in use** (~70% savings)
   ```bash
   # Stop EC2 + RDS on weekends/nights
   aws ec2 stop-instances --instance-ids $INSTANCE_ID
   aws rds stop-db-instance --db-instance-identifier waba-postgres-dev
   ```

2. **Use Spot Instances** (~70% savings)
   - Risk: Can be terminated
   - Good for: Non-critical testing

3. **Scheduled Scaling** with Lambda
   - Auto-start: 9 AM weekdays
   - Auto-stop: 6 PM weekdays

### Production Environment
1. **Reserved Instances** (~40% savings)
   - 1-year commitment
   - Pay upfront option

2. **Savings Plans** (~30-40% savings)
   - Flexible capacity commitment

3. **Right-sizing**
   - Monitor CloudWatch metrics
   - Scale down if under-utilized

4. **Storage Optimization**
   - Archive old media to S3 Glacier
   - Clean RabbitMQ queues regularly

## Recommendations by Use Case

### Small Business (< 100 conversations/day)
- **Start**: Development specs
- **Cost**: $35/month
- **When to upgrade**: > 50 concurrent users or 500 messages/min

### Medium Business (100-1000 conversations/day)
- **Start**: Production specs (base)
- **Cost**: $127/month
- **When to upgrade**: > 80% CPU or memory utilization

### Enterprise (> 1000 conversations/day)
- **Start**: Production specs (scaled)
- **Recommended**:
  - EC2: t3.xlarge or larger
  - RDS: db.r6g.large (memory optimized)
  - Consider ECS/EKS for auto-scaling
- **Cost**: $300-500/month+

## Monitoring & Alerts

Set up CloudWatch alarms for:
- CPU utilization > 80%
- Memory utilization > 80%
- Disk space < 20%
- RDS connections > 80% of max
- High error rates in logs

## Support & Resources

- **Development Guide**: `AWS_DEV_DEPLOYMENT.md`
- **Production Guide**: `AWS_DEPLOYMENT_GUIDE.md`
- **Quick Start**: `AWS_QUICK_START.md`
- **Management**: `./scripts/manage-aws.sh help`

## Quick Start Commands

### Deploy Development
```bash
./scripts/deploy-aws-dev.sh
```

### Deploy Production
```bash
./scripts/deploy-aws.sh
```

### Check Health
```bash
./scripts/manage-aws.sh health
```

### View Costs
```bash
# AWS Cost Explorer
aws ce get-cost-and-usage \
  --time-period Start=2025-03-01,End=2025-03-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=TAG,Key=Project
```
