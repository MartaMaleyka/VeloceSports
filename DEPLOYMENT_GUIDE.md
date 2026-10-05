# Deployment & DevOps Guide

## Overview

Complete deployment strategy for VeloceSports covering Docker containerization, CI/CD pipelines, production environment setup, monitoring, and disaster recovery.

## Architecture

```
Development    →    Staging    →    Production
  (Local)      CI/CD Pipeline    (AWS/Cloud)
   
Docker        Docker         Docker Compose
Development   Image          + Load Balancer
              Repository     + Database
              (Private)      + Cache/Queue
```

## Prerequisites

- Docker & Docker Compose
- Node.js 18+ LTS
- MySQL 8.0+
- AWS CLI (for cloud deployments)
- GitHub Actions (for CI/CD)

## Local Development

### Running with Docker Compose

**File**: `docker-compose.yml`

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile.dev
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: development
      DATABASE_URL: mysql://root:password@db:3306/velocesports
      JWT_SECRET: dev-secret-key
      LOG_LEVEL: debug
    depends_on:
      - db
    volumes:
      - ./apps/backend/src:/app/src
      - ./apps/backend/tests:/app/tests
    command: npm run dev

  frontend:
    build:
      context: ./apps/web
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
    depends_on:
      - backend
    volumes:
      - ./apps/web/src:/app/src
      - ./apps/web/public:/app/public

  db:
    image: mysql:8.0
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: velocesports
    volumes:
      - mysql_data:/var/lib/mysql
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql

  adminer:
    image: adminer
    ports:
      - "8080:8080"
    depends_on:
      - db

volumes:
  mysql_data:
```

**Start development environment**:
```bash
docker-compose up

# Access services
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
# Database UI: http://localhost:8080
```

## Docker Images

### Backend Dockerfile (Production)

**File**: `apps/backend/Dockerfile`

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built app
COPY --from=builder /app/dist ./dist

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

### Frontend Dockerfile (Production)

**File**: `apps/web/Dockerfile`

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build Next.js
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "start"]
```

**Build images**:
```bash
# Backend
docker build -t velocesports-backend:latest ./apps/backend

# Frontend
docker build -t velocesports-frontend:latest ./apps/web

# Push to registry
docker tag velocesports-backend:latest myregistry/velocesports-backend:latest
docker push myregistry/velocesports-backend:latest
```

## CI/CD Pipeline

### GitHub Actions Workflow

**File**: `.github/workflows/deploy.yml`

```yaml
name: Build, Test & Deploy

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: password
          MYSQL_DATABASE: velocesports_test
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
        ports:
          - 3306:3306

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Run unit tests
        run: npm test -- --coverage
        env:
          DATABASE_URL: mysql://root:password@localhost:3306/velocesports_test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: mysql://root:password@localhost:3306/velocesports_test

      - name: Build Docker images
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: |
          docker build -t myregistry/velocesports-backend:${{ github.sha }} ./apps/backend
          docker build -t myregistry/velocesports-frontend:${{ github.sha }} ./apps/web
          docker tag myregistry/velocesports-backend:${{ github.sha }} myregistry/velocesports-backend:latest
          docker tag myregistry/velocesports-frontend:${{ github.sha }} myregistry/velocesports-frontend:latest

      - name: Push Docker images
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push myregistry/velocesports-backend:${{ github.sha }}
          docker push myregistry/velocesports-frontend:${{ github.sha }}
          docker push myregistry/velocesports-backend:latest
          docker push myregistry/velocesports-frontend:latest

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Deploy to staging
        run: |
          # Deploy to staging environment
          aws ecs update-service \
            --cluster velocesports-staging \
            --service backend \
            --force-new-deployment

      - name: Run smoke tests
        run: npm run test:e2e
        env:
          NEXT_PUBLIC_API_URL: https://staging-api.velocesports.com

      - name: Deploy to production
        if: success()
        run: |
          aws ecs update-service \
            --cluster velocesports-production \
            --service backend \
            --force-new-deployment
```

## Production Deployment

### AWS ECS Deployment

**Task Definition** (`backend-task-definition.json`):

```json
{
  "family": "velocesports-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "myregistry/velocesports-backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "hostPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "LOG_LEVEL",
          "value": "info"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:db-url"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/velocesports-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

**Service Definition** (`backend-service.json`):

```json
{
  "serviceName": "velocesports-backend",
  "cluster": "velocesports-production",
  "taskDefinition": "velocesports-backend",
  "desiredCount": 3,
  "launchType": "FARGATE",
  "deploymentConfiguration": {
    "maximumPercent": 200,
    "minimumHealthyPercent": 100
  },
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-xxx", "subnet-yyy"],
      "securityGroups": ["sg-xxx"],
      "assignPublicIp": "DISABLED"
    }
  },
  "loadBalancers": [
    {
      "targetGroupArn": "arn:aws:elasticloadbalancing:...",
      "containerName": "backend",
      "containerPort": 3001
    }
  ]
}
```

**Deploy**:
```bash
# Register task definition
aws ecs register-task-definition --cli-input-json file://backend-task-definition.json

# Update service
aws ecs update-service \
  --cluster velocesports-production \
  --service velocesports-backend \
  --task-definition velocesports-backend:latest \
  --force-new-deployment
```

## Database Management

### Migrations

**Run migrations**:
```bash
npm run db:migrate

# Check migration status
npm run db:migrate:status

# Rollback last migration
npm run db:migrate:down
```

**Create new migration**:
```bash
npm run db:migrate:create -- create_users_table
```

### Backups

**Automated daily backup**:
```bash
# Enable automated backups in AWS RDS
aws rds modify-db-instance \
  --db-instance-identifier velocesports-db \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00"
```

**Manual backup**:
```bash
# Local backup
mysqldump -u root -p velocesports > backup-$(date +%Y%m%d-%H%M%S).sql

# AWS RDS backup
aws rds create-db-snapshot \
  --db-instance-identifier velocesports-db \
  --db-snapshot-identifier velocesports-backup-$(date +%Y%m%d-%H%M%S)
```

**Restore from backup**:
```bash
# From file
mysql -u root -p velocesports < backup-20261004-100000.sql

# From AWS RDS snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier velocesports-db-restored \
  --db-snapshot-identifier velocesports-backup-20261004-100000
```

## Environment Configuration

### Production Environment Variables

**Backend** (`.env.production`):
```
NODE_ENV=production
PORT=3001
DATABASE_URL=mysql://user:pass@db.rds.amazonaws.com:3306/velocesports
JWT_SECRET=<very-long-random-string>
MINIO_URL=https://s3.amazonaws.com/velocesports
MINIO_ACCESS_KEY=<access-key>
MINIO_SECRET_KEY=<secret-key>
LOG_LEVEL=info
CORS_ORIGINS=https://velocesports.com,https://www.velocesports.com
SENTRY_DSN=https://key@sentry.io/project-id
```

**Frontend** (`.env.production`):
```
NEXT_PUBLIC_API_URL=https://api.velocesports.com
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_DSN=https://key@sentry.io/project-id
```

### Secrets Management

**Using AWS Secrets Manager**:
```bash
# Store secret
aws secretsmanager create-secret \
  --name velocesports/jwt-secret \
  --secret-string "your-secret-key"

# Retrieve secret
aws secretsmanager get-secret-value \
  --secret-id velocesports/jwt-secret
```

## Monitoring & Logging

### CloudWatch Monitoring

```typescript
// Custom metrics
import { CloudWatch } from 'aws-sdk';

const cloudwatch = new CloudWatch();

cloudwatch.putMetricData({
  Namespace: 'VeloceSports/Backend',
  MetricData: [
    {
      MetricName: 'CoachAnalysisDuration',
      Value: duration,
      Unit: 'Milliseconds',
      Timestamp: new Date(),
    },
  ],
}).promise();
```

### Alarms

**Database performance alarm**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name velocesports-db-cpu-high \
  --alarm-description "Alert if RDS CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

**API error rate alarm**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name velocesports-api-errors \
  --alarm-description "Alert if error rate > 1%" \
  --metric-name 5XXError \
  --namespace AWS/ELB \
  --statistic Sum \
  --period 300 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold
```

### Log Analysis

**Query logs in CloudWatch Logs Insights**:
```sql
-- Find slow requests
fields @timestamp, duration, path
| filter duration > 500
| stats count() by path
| sort count() desc
```

## Health Checks

### Health Endpoint

**Implementation** (`apps/backend/src/routes/health.ts`):

```typescript
router.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    database: 'checking',
  };

  // Check database connection
  db.query('SELECT 1')
    .then(() => {
      health.database = 'connected';
      res.status(200).json(health);
    })
    .catch(() => {
      health.database = 'disconnected';
      health.status = 'degraded';
      res.status(503).json(health);
    });
});
```

### Readiness Check

```typescript
router.get('/readiness', (req, res) => {
  const checks = {
    database: false,
    cache: false,
    fileStorage: false,
  };

  // Check all dependencies
  Promise.all([
    db.query('SELECT 1').then(() => checks.database = true),
    cache.ping().then(() => checks.cache = true),
    s3.headBucket().then(() => checks.fileStorage = true),
  ]).then(() => {
    const ready = Object.values(checks).every(v => v);
    res.status(ready ? 200 : 503).json(checks);
  });
});
```

## Scaling

### Horizontal Scaling

```bash
# Scale ECS service to 5 tasks
aws ecs update-service \
  --cluster velocesports-production \
  --service velocesports-backend \
  --desired-count 5
```

### Auto Scaling

```bash
# Enable auto scaling
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/velocesports-production/backend \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

# Add scaling policy (scale up at 70% CPU)
aws application-autoscaling put-scaling-policy \
  --policy-name scale-up \
  --service-namespace ecs \
  --resource-id service/velocesports-production/backend \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration \
    TargetValue=70,PredefinedMetricSpecification={PredefinedMetricType=ECSServiceAverageCPUUtilization}
```

## Disaster Recovery

### RTO & RPO Targets

| Component | RTO | RPO |
|-----------|-----|-----|
| Database | 1 hour | 5 minutes |
| Application | 15 minutes | 0 minutes |
| File Storage | 2 hours | 1 hour |

### Recovery Procedures

**Database failure**:
1. Detect: CloudWatch alarm triggers
2. Failover: Automatic RDS failover to replica
3. Verify: Run smoke tests
4. Monitor: Track recovery metrics

**Application failure**:
1. Detect: Health check fails
2. Action: Auto Scaling replaces task
3. Verify: New task joins load balancer
4. Monitor: Traffic redistributed

**Complete outage**:
1. Invoke disaster recovery plan
2. Restore from latest backup
3. Verify data integrity
4. Restore application services
5. Run full test suite
6. Restore DNS/load balancer routes

### Backup Schedule

```
Database:
  - Hourly snapshots (24 hours retention)
  - Daily snapshots (7 days retention)
  - Weekly snapshots (4 weeks retention)
  - Monthly snapshots (12 months retention)

Application:
  - Container image stored in registry
  - Code stored in GitHub
  - Configuration in Secrets Manager
```

## Production Checklist

- [ ] All secrets in Secrets Manager (never in code)
- [ ] Database backups automated and tested
- [ ] Health endpoints working
- [ ] Monitoring and alerting configured
- [ ] Log aggregation enabled
- [ ] HTTPS enabled with valid certificate
- [ ] Security groups/NSGs configured
- [ ] Database encrypted at rest
- [ ] Secrets encrypted
- [ ] Rate limiting configured
- [ ] DDoS protection enabled
- [ ] WAF rules configured
- [ ] Load balancer health checks working
- [ ] Auto scaling policies active
- [ ] Disaster recovery plan documented
- [ ] Smoke tests automated
- [ ] Incident response playbooks ready
- [ ] On-call rotation established
- [ ] Cost monitoring active
- [ ] Performance baselines established

## Troubleshooting

### Service won't start
```bash
# Check logs
aws logs tail /ecs/velocesports-backend --follow

# Check task definition
aws ecs describe-tasks \
  --cluster velocesports-production \
  --tasks <task-arn> \
  --query 'tasks[0].{Status:lastStatus,StoppedReason:stoppedReason}'
```

### Database connection timeout
```bash
# Check security group
aws ec2 describe-security-groups --group-ids sg-xxx

# Test connection
mysql -h db.rds.amazonaws.com -u admin -p -e "SELECT 1"
```

### High CPU usage
```bash
# Check top processes
top

# Check container logs
docker logs <container-id>

# Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=backend
```

---

**Last Updated**: 2026-10-04  
**Status**: Production deployment infrastructure ready
