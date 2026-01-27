const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
  connectionString: config.database.connectionString
});

class GenesysUser {
  /**
   * Find or create user from Genesys OAuth data
   * Auto-provisions user on first login
   */
  static async findOrCreateFromGenesys(genesysData, tenantId) {
    const { id: genesysUserId, email, name } = genesysData;

    // Try to find existing user
    let user = await this.findByGenesysUserId(genesysUserId);

    if (!user) {
      // Create new user (auto-provisioning)
      const role = this.inferRoleFromGenesys(genesysData);

      const query = `
        INSERT INTO genesys_users (tenant_id, genesys_user_id, genesys_email, name, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING user_id, tenant_id, genesys_user_id, genesys_email, name, role, created_at
      `;

      const result = await pool.query(query, [tenantId, genesysUserId, email, name, role]);
      user = result.rows[0];
    } else if (user.tenant_id !== tenantId) {
      // User exists but belongs to different tenant - this shouldn't happen
      throw new Error('User belongs to a different organization');
    }

    return user;
  }

  /**
   * Find user by Genesys user ID
   */
  static async findByGenesysUserId(genesysUserId) {
    const query = `
      SELECT user_id, tenant_id, genesys_user_id, genesys_email, name, role, is_active, created_at, last_login_at
      FROM genesys_users
      WHERE genesys_user_id = $1
    `;

    const result = await pool.query(query, [genesysUserId]);
    return result.rows[0];
  }

  /**
   * Find user by ID
   */
  static async findById(userId) {
    const query = `
      SELECT user_id, tenant_id, genesys_user_id, genesys_email, name, role, is_active, created_at, last_login_at
      FROM genesys_users
      WHERE user_id = $1
    `;

    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(userId) {
    const query = `
      UPDATE genesys_users
      SET last_login_at = NOW()
      WHERE user_id = $1
    `;

    await pool.query(query, [userId]);
  }

  /**
   * Create user session
   */
  static async createSession(sessionData) {
    const { user_id, access_token, refresh_token, expires_at, ip_address, user_agent } = sessionData;

    const query = `
      INSERT INTO genesys_user_sessions (user_id, access_token, refresh_token, expires_at, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING session_id, user_id, expires_at, created_at
    `;

    const result = await pool.query(query, [user_id, access_token, refresh_token, expires_at, ip_address, user_agent]);
    return result.rows[0];
  }

  /**
   * Get tenant's WhatsApp configuration
   * (WhatsApp is at tenant level, not user level)
   */
  static async getTenantWhatsAppConfig(userId) {
    const query = `
      SELECT twc.waba_id, twc.phone_number_id, twc.display_phone_number, twc.created_at, t.tenant_name
      FROM genesys_users gu
      JOIN tenants t ON gu.tenant_id = t.tenant_id
      LEFT JOIN tenant_whatsapp_config twc ON t.tenant_id = twc.tenant_id
      WHERE gu.user_id = $1
    `;

    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Get all users in the same tenant
   */
  static async findByTenant(tenantId) {
    const query = `
      SELECT user_id, genesys_user_id, genesys_email, name, role, is_active, last_login_at
      FROM genesys_users
      WHERE tenant_id = $1
      ORDER BY name ASC
    `;

    const result = await pool.query(query, [tenantId]);
    return result.rows;
  }

  /**
   * Update user role (admin/supervisor/agent)
   */
  static async updateRole(userId, role) {
    const validRoles = ['admin', 'supervisor', 'agent'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role');
    }

    const query = `
      UPDATE genesys_users
      SET role = $1, updated_at = NOW()
      WHERE user_id = $2
      RETURNING user_id, name, role
    `;

    const result = await pool.query(query, [role, userId]);
    return result.rows[0];
  }

  /**
   * Create user from Genesys data
   */
  static async createFromGenesys(genesysUser, tenantId) {
    const role = this.inferRoleFromGenesys(genesysUser);

    // Check if user already exists based on genesys_user_id
    // This is a safeguard for the sync process
    const existingUser = await this.findByGenesysUserId(genesysUser.id);

    if (existingUser) {
      return this.updateFromGenesys(existingUser.user_id, genesysUser);
    }

    const query = `
      INSERT INTO genesys_users 
      (tenant_id, genesys_user_id, genesys_email, name, role) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *
    `;

    const result = await pool.query(query,
      [tenantId, genesysUser.id, genesysUser.email, genesysUser.name, role]
    );

    return result.rows[0];
  }

  /**
   * Update user from Genesys data
   */
  static async updateFromGenesys(userId, genesysUser) {
    const role = this.inferRoleFromGenesys(genesysUser);

    const query = `
      UPDATE genesys_users 
      SET name = $1, genesys_email = $2, role = $3, updated_at = NOW()
      WHERE user_id = $4
      RETURNING *
    `;

    const result = await pool.query(query,
      [genesysUser.name, genesysUser.email, role, userId]
    );

    return result.rows[0];
  }

  /**
   * Infer role from Genesys user authorization
   */
  static inferRoleFromGenesys(genesysUser) {
    // Check if user has admin permissions
    const roles = genesysUser.authorization?.roles || [];

    if (roles.some(r => r.name?.toLowerCase().includes('admin'))) {
      return 'admin';
    }

    if (roles.some(r => r.name?.toLowerCase().includes('supervisor'))) {
      return 'supervisor';
    }

    return 'agent';
  }
}

class ConversationAssignment {
  /**
   * Assign conversation to user
   */
  static async assign(conversationId, userId, tenantId) {
    const query = `
      INSERT INTO conversation_assignments (conversation_id, user_id, tenant_id, status)
      VALUES ($1, $2, $3, 'active')
      ON CONFLICT (conversation_id, user_id) 
      DO UPDATE SET last_activity_at = NOW(), status = 'active'
      RETURNING assignment_id, conversation_id, user_id, assigned_at, status
    `;

    const result = await pool.query(query, [conversationId, userId, tenantId]);
    return result.rows[0];
  }

  /**
   * Find assignment by conversation
   */
  static async findByConversation(conversationId) {
    const query = `
      SELECT ca.*, gu.name as user_name, gu.role as user_role
      FROM conversation_assignments ca
      JOIN genesys_users gu ON ca.user_id = gu.user_id
      WHERE ca.conversation_id = $1 AND ca.status = 'active'
      ORDER BY ca.assigned_at DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [conversationId]);
    return result.rows[0];
  }

  /**
   * Get all assignments for a user
   */
  static async findByUser(userId) {
    const query = `
      SELECT conversation_id, assigned_at, last_activity_at, status
      FROM conversation_assignments
      WHERE user_id = $1 AND status = 'active'
      ORDER BY last_activity_at DESC
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Transfer conversation to another user
   */
  static async transfer(conversationId, fromUserId, toUserId) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Close old assignment
      await client.query(
        `UPDATE conversation_assignments 
         SET status = 'transferred', updated_at = NOW() 
         WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, fromUserId]
      );

      // Get tenant ID from the user
      const userResult = await client.query(
        'SELECT tenant_id FROM genesys_users WHERE user_id = $1',
        [toUserId]
      );

      // Create new assignment
      const result = await client.query(
        `INSERT INTO conversation_assignments (conversation_id, user_id, tenant_id, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING assignment_id, conversation_id, user_id, assigned_at`,
        [conversationId, toUserId, userResult.rows[0].tenant_id]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = { GenesysUser, ConversationAssignment };
