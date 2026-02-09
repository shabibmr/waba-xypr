# MVP Implementation - Quick Start Index

**Created:** 2026-02-05
**Updated:** 2026-02-09
**Total Guides:** 13 files (00-12) - All guides created ✅

---

## 📊 Status Overview

| File | Priority | Est Hours | Status | Dependencies |
|------|----------|-----------|--------|--------------|
| **00_infrastructure_setup.md** | 🔴 CRITICAL | 2-3h | ✅ Created | None |
| **01_state_manager.md** | 🔴 CRITICAL | 6-8h | ✅ Created | 00 |
| **02_tenant_service.md** | 🟡 HIGH | 3-4h | ✅ Created | 00 |
| **03_auth_service.md** | 🟡 HIGH | 2-3h | ✅ Created | 00 |
| **04_whatsapp_webhook.md** | 🟢 MEDIUM | 2h | ✅ Created (Feb 9) | 00, 02 |
| **05_inbound_transformer.md** | 🟡 HIGH | 4-6h | ✅ Created | 00, 01, 06 |
| **06_genesys_api_service.md** | 🟡 HIGH | 4-5h | ✅ Created | 00, 02, 03 |
| **07_genesys_webhook.md** | 🟡 HIGH | 3-4h | ✅ Created (Feb 9) | 00, 02 |
| **08_outbound_transformer.md** | 🟡 HIGH | 5-7h | ✅ Created | 00, 01, 07, 09 |
| **09_whatsapp_api_service.md** | 🟡 HIGH | 4-5h | ✅ Created | 00, 02, 03 |
| **10_api_gateway.md** | 🟢 MEDIUM | 2-3h | ✅ Created (Feb 9) | None |
| **11_customer_portal.md** | 🔵 LOW | 6-8h | ✅ Created (Feb 9) | 02 |
| **12_agent_widget.md** | 🔵 LOW | 8-10h | ✅ Created (Feb 9) | 02, Full flow |

---

## ⚡ Execution Plan

**Status:** All guides created ✅ - Ready for implementation!

### Phase 1: Foundation (Day 1)
**Solo Work - Sequential**
- [ ] Implement `00_infrastructure_setup.md` (2-3h)
  - PostgreSQL, Redis, MinIO, RabbitMQ
  - **BLOCKS EVERYTHING ELSE**

### Phase 2: Core Services (Day 1-2)
**3 Developers - Parallel**
- [ ] Dev A: Implement `01_state_manager.md` (6-8h)
- [ ] Dev B: Implement `02_tenant_service.md` (3-4h) → `03_auth_service.md` (2-3h)
- [ ] Dev C: Implement `04_whatsapp_webhook.md` (2h) → `10_api_gateway.md` (2-3h)

### Phase 3: API Services (Day 2-3)
**3 Developers - Parallel** (After Phase 2)
- [ ] Dev A: Implement `06_genesys_api_service.md` (4-5h)
- [ ] Dev B: Implement `07_genesys_webhook.md` (3-4h)
- [ ] Dev C: Implement `09_whatsapp_api_service.md` (4-5h)

### Phase 4: Transformers (Day 3-4)
**2 Developers - Parallel** (After Phase 3)
- [ ] Dev A: Implement `05_inbound_transformer.md` (4-6h)
- [ ] Dev B: Implement `08_outbound_transformer.md` (5-7h)

### Phase 5: Frontend & Polish (Day 4-5)
- [ ] Implement `11_customer_portal.md` (6-8h) - Optional but recommended
- [ ] Implement `12_agent_widget.md` (8-10h) - Advanced feature
- [ ] End-to-end testing
- [ ] Bug fixes and optimization

---

## 🎯 Critical Path (Minimum for MVP Demo)

```
00 Infrastructure (MUST DO FIRST)
  └─→ 01 State Manager (CRITICAL)
  └─→ 02 Tenant Service → 03 Auth Service → 06 Genesys API
  └─→ 02 Tenant Service → 03 Auth Service → 09 WhatsApp API
  └─→ 02 Tenant Service → 07 Genesys Webhook

Then (parallel):
  05 Inbound Transformer (needs 01 + 06)
  08 Outbound Transformer (needs 01 + 07 + 09)

Result: Full inbound + outbound message flow with media support
```

---

## 📋 Checklist for Each Guide

Before starting any guide:
- [ ] Read entire guide first
- [ ] Check guard rails (prerequisites)
- [ ] Create git branch: `feature/mvp/<task-name>`
- [ ] Set up `.env` file

While implementing:
- [ ] Follow steps sequentially
- [ ] Test after each major step
- [ ] Document any deviations

After completion:
- [ ] Run all verification steps
- [ ] Update this index (mark as ✅)
- [ ] Commit and push
- [ ] Notify team

---

## 🚀 Quick Command Reference

### Start Infrastructure
```bash
cd /path/to/waba-xypr
./scripts/setup-infrastructure.sh
```

### Start a Service
```bash
cd services/<service-name>
npm install
npm run dev
```

### Test RabbitMQ Message
```bash
# Publish to queue
curl -u guest:guest -X POST \
  "http://localhost:15672/api/exchanges/%2F/amq.default/publish" \
  -H "content-type:application/json" \
  -d '{"routing_key":"QUEUE_NAME","payload":"..."}'
```

### Check Database
```bash
psql -h localhost -U postgres -d waba_mvp -c "SELECT * FROM tenants;"
```

### Check Redis
```bash
redis-cli keys "*"
redis-cli get "mapping:wa:+919876543210"
```

### Check MinIO
```bash
docker run --rm --network host minio/mc ls local/
```

---

## 🔥 Hot Tips

1. **Start with 00** - Don't skip infrastructure!
2. **Run tests frequently** - Every guide has verification steps
3. **Use Redis caching** - Check cache before DB queries
4. **Monitor queues** - RabbitMQ UI at http://localhost:15672
5. **Check logs** - Use `docker-compose logs -f <service>`

---

## 🆘 Emergency Troubleshooting

### All Services Won't Start
```bash
docker-compose down -v
docker-compose up -d
./scripts/setup-infrastructure.sh
```

### Database Issues
```bash
# Recreate database
dropdb waba_mvp
createdb waba_mvp
# Re-run migrations from 00_infrastructure_setup.md
```

### RabbitMQ Not Processing
```bash
# Check queue status
curl -u guest:guest http://localhost:15672/api/queues

# Restart RabbitMQ
docker-compose restart rabbitmq
```

---

## 📞 Need Help?

- **Missing guide?** Refer to [pending_tasks.md](../pending_tasks.md)
- **Architecture questions?** See [mvp_scope_plan.md](../mvp_scope_plan.md)
- **Overall plan?** Check [implementation_plan.md](../.gemini/antigravity/brain/.../implementation_plan.md)

---

## ✅ Final Deliverable Checklist

By end of MVP:
- [ ] Infrastructure script runs successfully
- [ ] All 10 services respond to /health
- [ ] Can send WhatsApp text → Genesys
- [ ] Can send WhatsApp image → Genesys
- [ ] Can send Genesys text → WhatsApp
- [ ] Can send Genesys document → WhatsApp
- [ ] Database shows conversation mappings
- [ ] Database shows message tracking
- [ ] Redis shows cached mappings
- [ ] MinIO shows webhook payloads & media
- [ ] Customer portal onboarding works

---

**Next Action:** Complete `00_infrastructure_setup.md` now!
