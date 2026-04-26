require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const app = require('./app');

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Nexus server running on port ${PORT}`));
