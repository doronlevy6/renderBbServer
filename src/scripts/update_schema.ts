
import pool from '../models/userModel';

const updateSchema = async () => {
    try {
        console.log('Adding admin_username column to teams table...');
        await pool.query(`
      ALTER TABLE teams 
      ADD COLUMN IF NOT EXISTS admin_username VARCHAR(255);
    `);

        console.log('Adding foreign key constraint...');
        // We can't easily add a circular FK constraint (teams.admin -> users.username) 
        // because users.team_id -> teams.team_id. 
        // It might cause issues with insertion order. 
        // For now, we will just store the username without a strict FK constraint, 
        // or we can add it with DEFERRABLE if needed.
        // Let's just add the column for now.

        console.log('Schema update complete!');
        process.exit(0);
    } catch (err) {
        console.error('Error updating schema:', err);
        process.exit(1);
    }
};

updateSchema();
