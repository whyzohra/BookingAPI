const EmbeddedPostgres = require('embedded-postgres').default;

const pg = new EmbeddedPostgres({
  port: 5432,
  databaseDir: '.pg-data',
  user: 'postgres',
  password: 'postgres',
  persistent: true,
});

async function main() {
  const action = process.argv[2] || 'start';
  if (action === 'start') {
    try {
      await pg.initialise();
    } catch (e) {
      // already initialized
    }
    await pg.start();
    try {
      await pg.createDatabase('appointment_booking');
    } catch (e) {
      // already exists
    }
    console.log('PostgreSQL is running on localhost:5432');
  } else if (action === 'stop') {
    await pg.stop();
    console.log('PostgreSQL has stopped.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
