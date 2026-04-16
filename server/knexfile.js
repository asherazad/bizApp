require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const base = {
  client: 'pg',
  migrations: { directory: './db/migrations' },
  seeds:      { directory: './db/seeds' },
}

module.exports = {
  development: {
    ...base,
    connection: process.env.DATABASE_URL || {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME     || 'bizportal',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
    pool: { min: 2, max: 10 },
  },
  production: {
    ...base,
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },  // required for Supabase
    },
    pool: { min: 0, max: 2 },
  },
}
