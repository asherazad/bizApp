require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

module.exports = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL || {
      host:     process.env.DB_HOST     || 'localhost',
      port:     process.env.DB_PORT     || 5432,
      database: process.env.DB_NAME     || 'nexus_dev',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
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
    pool:       { min: 1, max: 3 },
  },
};
