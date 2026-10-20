require('dotenv').config();

const { startBot } = require('./bot');
const { createServer } = require('./server');

const PORT = process.env.PORT || 3000;

// Start Express server
const app = createServer();
app.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
});

// Start Discord self-bot
startBot();
