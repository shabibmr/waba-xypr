const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: config.database.connectionString
});

class Template {
  /**
   * Create templates table if it doesn't exist (called on startup)
   */
  static async ensureTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS templates (
        id              SERIAL PRIMARY KEY,
        tenant_id       VARCHAR(64) NOT NULL,
        meta_template_id VARCHAR(64),
        name            VARCHAR(512) NOT NULL,
        category        VARCHAR(32) NOT NULL,
        language        VARCHAR(16) NOT NULL,
        status          VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        quality_score   VARCHAR(16),
        components      JSONB NOT NULL DEFAULT '[]',
        sample_values   JSONB DEFAULT '{}',
        rejected_reason TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, name, language)
      );

      CREATE INDEX IF NOT EXISTS idx_templates_tenant ON templates(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(tenant_id, status);
    `;

    await pool.query(query);
    logger.info('Templates table ensured');
  }

  /**
   * Find templates by tenant with optional filters
   */
  static async findByTenant(tenantId, { category, status, search, language, limit = 50, offset = 0 } = {}) {
    const conditions = ['tenant_id = $1'];
    const params = [tenantId];
    let paramIndex = 2;

    if (category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (search) {
      conditions.push(`name ILIKE $${paramIndex++}`);
      params.push(`%${search}%`);
    }

    if (language) {
      conditions.push(`language = $${paramIndex++}`);
      params.push(language);
    }

    const where = conditions.join(' AND ');
    params.push(limit, offset);

    const query = `
      SELECT id, tenant_id, meta_template_id, name, category, language,
             status, quality_score, components, sample_values, rejected_reason,
             created_at, updated_at
      FROM templates
      WHERE ${where}
      ORDER BY updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Count templates by tenant with optional filters (for pagination)
   */
  static async countByTenant(tenantId, { category, status, search, language } = {}) {
    const conditions = ['tenant_id = $1'];
    const params = [tenantId];
    let paramIndex = 2;

    if (category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (search) {
      conditions.push(`name ILIKE $${paramIndex++}`);
      params.push(`%${search}%`);
    }

    if (language) {
      conditions.push(`language = $${paramIndex++}`);
      params.push(language);
    }

    const where = conditions.join(' AND ');

    const query = `SELECT COUNT(*)::int AS total FROM templates WHERE ${where}`;
    const result = await pool.query(query, params);
    return result.rows[0].total;
  }

  /**
   * Find template by ID (scoped to tenant)
   */
  static async findById(id, tenantId) {
    const query = `
      SELECT id, tenant_id, meta_template_id, name, category, language,
             status, quality_score, components, sample_values, rejected_reason,
             created_at, updated_at
      FROM templates
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await pool.query(query, [id, tenantId]);
    return result.rows[0];
  }

  /**
   * Find template by name and language (scoped to tenant)
   */
  static async findByNameAndLanguage(tenantId, name, language) {
    const query = `
      SELECT id, tenant_id, meta_template_id, name, category, language,
             status, quality_score, components, sample_values, rejected_reason,
             created_at, updated_at
      FROM templates
      WHERE tenant_id = $1 AND name = $2 AND language = $3
    `;

    const result = await pool.query(query, [tenantId, name, language]);
    return result.rows[0];
  }

  /**
   * Create a new template
   */
  static async create({ tenantId, metaTemplateId, name, category, language, status = 'PENDING', components = [], sampleValues = {} }) {
    const query = `
      INSERT INTO templates (tenant_id, meta_template_id, name, category, language, status, components, sample_values)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, tenant_id, meta_template_id, name, category, language,
                status, quality_score, components, sample_values, rejected_reason,
                created_at, updated_at
    `;

    const result = await pool.query(query, [
      tenantId, metaTemplateId, name, category, language, status,
      JSON.stringify(components), JSON.stringify(sampleValues)
    ]);
    return result.rows[0];
  }

  /**
   * Update a template (scoped to tenant)
   */
  static async update(id, tenantId, fields) {
    const allowed = ['meta_template_id', 'name', 'category', 'language', 'status', 'quality_score', 'components', 'sample_values', 'rejected_reason'];
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (!allowed.includes(key)) continue;
      setClauses.push(`${key} = $${paramIndex++}`);
      params.push(key === 'components' || key === 'sample_values' ? JSON.stringify(value) : value);
    }

    if (setClauses.length === 0) return null;

    setClauses.push(`updated_at = NOW()`);
    params.push(id, tenantId);

    const query = `
      UPDATE templates
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
      RETURNING id, tenant_id, meta_template_id, name, category, language,
                status, quality_score, components, sample_values, rejected_reason,
                created_at, updated_at
    `;

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  /**
   * Delete a template (scoped to tenant)
   */
  static async delete(id, tenantId) {
    const query = `
      DELETE FROM templates
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, name
    `;

    const result = await pool.query(query, [id, tenantId]);
    return result.rows[0];
  }

  /**
   * Upsert a template from Meta sync data
   */
  static async upsertFromMeta(tenantId, metaTemplate) {
    const { id: metaTemplateId, name, category, language, status, quality_score, components, rejected_reason } = metaTemplate;

    const query = `
      INSERT INTO templates (tenant_id, meta_template_id, name, category, language, status, quality_score, components, rejected_reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tenant_id, name, language)
      DO UPDATE SET
        meta_template_id = EXCLUDED.meta_template_id,
        category = EXCLUDED.category,
        status = EXCLUDED.status,
        quality_score = EXCLUDED.quality_score,
        components = EXCLUDED.components,
        rejected_reason = EXCLUDED.rejected_reason,
        updated_at = NOW()
      WHERE templates.meta_template_id IS DISTINCT FROM EXCLUDED.meta_template_id
         OR templates.category IS DISTINCT FROM EXCLUDED.category
         OR templates.status IS DISTINCT FROM EXCLUDED.status
         OR templates.quality_score IS DISTINCT FROM EXCLUDED.quality_score
         OR templates.components IS DISTINCT FROM EXCLUDED.components
         OR templates.rejected_reason IS DISTINCT FROM EXCLUDED.rejected_reason
      RETURNING id, tenant_id, meta_template_id, name, category, language,
                status, quality_score, components, sample_values, rejected_reason,
                created_at, updated_at,
                (xmax = 0) AS is_new
    `;

    const result = await pool.query(query, [
      tenantId, metaTemplateId, name, category, language,
      status || 'PENDING', quality_score || null,
      JSON.stringify(components || []), rejected_reason || null
    ]);

    return result.rows[0];
  }

  /**
   * Update template status (used by webhook handler)
   */
  static async updateStatus(metaTemplateId, status, rejectedReason, qualityScore) {
    const query = `
      UPDATE templates
      SET status = $1,
          rejected_reason = COALESCE($2, rejected_reason),
          quality_score = COALESCE($3, quality_score),
          updated_at = NOW()
      WHERE meta_template_id = $4
      RETURNING id, tenant_id, meta_template_id, name, category, language,
                status, quality_score, rejected_reason, updated_at
    `;

    const result = await pool.query(query, [status, rejectedReason || null, qualityScore || null, metaTemplateId]);
    return result.rows[0];
  }
}

module.exports = Template;
