import Postgrator from 'postgrator';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pino } from 'pino';
const logger = pino({
    name: 'migration'
});
const __dirname = dirname(fileURLToPath(import.meta.url));
export async function migrate(pool, targetMigrationStep = undefined) {
    let client = undefined;
    logger.info({ targetMigrationStep }, 'Starting DB schema migration');
    try {
        client = await pool.connect();
        const postgrator = new Postgrator({
            migrationPattern: path.join(__dirname, '*'),
            driver: 'pg',
            schemaTable: 'schemaversion',
            execQuery: query => client.query(query)
        });
        const migrations = await postgrator.migrate(targetMigrationStep);
        logger.info({ migrations, targetMigrationStep }, 'Migrations applied');
    }
    catch (error) {
        logger.error({ migrations: error.appliedMigrations, targetMigrationStep }, error.message);
    }
    finally {
        await client?.release();
    }
    logger.info({ targetMigrationStep }, 'Migration completed');
}
