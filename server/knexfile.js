require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

module.exports = {
  development: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    migrations: { directory: __dirname + '/db/migrations' },
    seeds:      { directory: __dirname + '/db/seeds' },
    pool:       { min: 1, max: 5 },
  },

  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    migrations: { directory: __dirname + '/db/migrations' },
    seeds:      { directory: __dirname + '/db/seeds' },
    pool:       { min: 0, max: 3, acquireTimeoutMillis: 10000 },
    // pgBouncer transaction mode requires this
    asyncStackTraces: false,
  },
};
