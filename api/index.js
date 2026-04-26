// Vercel serverless entry — must stay CommonJS (api/package.json enforces this)
require('dotenv').config();
const app = require('../server/app');

module.exports = app;
