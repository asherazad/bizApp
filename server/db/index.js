const knex = require('knex');
const knexConfig = require('../knexfile');

const env = process.env.NODE_ENV || 'development';

if (!global.__nexusDb) {
  global.__nexusDb = knex(knexConfig[env]);
}

module.exports = global.__nexusDb;
