const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
    connectionString: config.database.connectionString
});

class Conversation {
    /**
     * Find all conversations for a specific phone number ID (tenant filter)
     */
    static async findAllByPhoneNumberId(phoneNumberId, limit = 20, offset = 0) {
        const query = `
      SELECT 
        cm.*,
        (
          SELECT json_build_object(
            'user_id', ca.user_id,
            'user_name', gu.name,
            'assigned_at', ca.assigned_at
          )
          FROM conversation_assignments ca
          JOIN genesys_users gu ON ca.user_id = gu.user_id
          WHERE ca.conversation_id = cm.conversation_id AND ca.status = 'active'
          LIMIT 1
        ) as assigned_to
      FROM conversation_mappings cm
      WHERE cm.phone_number_id = $1
      ORDER BY cm.last_activity_at DESC
      LIMIT $2 OFFSET $3
    `;

        const result = await pool.query(query, [phoneNumberId, limit, offset]);
        return result.rows;
    }

    /**
     * Count conversations for pagination
     */
    static async countByPhoneNumberId(phoneNumberId) {
        const query = `
      SELECT count(*) as total
      FROM conversation_mappings
      WHERE phone_number_id = $1
    `;

        const result = await pool.query(query, [phoneNumberId]);
        return parseInt(result.rows[0].total);
    }
}

module.exports = Conversation;
