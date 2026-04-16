/**
 * Database singleton.
 * - In serverless (Vercel): uses global.__db set by api/index.js
 * - In local dev:           creates its own Knex instance
 */
const knex = require('knex')

// If running inside Vercel serverless function, api/index.js
// sets global.__db before any route module loads.
if (global.__db) {
  module.exports = global.__db
} else {
  // Local development — load from knexfile
  require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
  const config = require('../knexfile')
  const env    = process.env.NODE_ENV || 'development'
  const db     = knex(config[env])
  global.__db  = db
  module.exports = db
}
