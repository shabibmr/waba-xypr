exports.up = (pgm) => {
    pgm.sql(`
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email text UNIQUE;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain text;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone_number_id text;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS genesys_integration_id text;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';
        
        CREATE INDEX IF NOT EXISTS tenants_phone_number_id_index ON tenants (phone_number_id);
        CREATE INDEX IF NOT EXISTS tenants_genesys_integration_id_index ON tenants (genesys_integration_id);
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        ALTER TABLE tenants DROP COLUMN IF EXISTS email;
        ALTER TABLE tenants DROP COLUMN IF EXISTS domain;
        ALTER TABLE tenants DROP COLUMN IF EXISTS phone_number_id;
        ALTER TABLE tenants DROP COLUMN IF EXISTS genesys_integration_id;
        ALTER TABLE tenants DROP COLUMN IF EXISTS settings;
        
        DROP INDEX IF EXISTS tenants_phone_number_id_index;
        DROP INDEX IF EXISTS tenants_genesys_integration_id_index;
    `);
};
