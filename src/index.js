const app = require('discord-r9k-framework');
const markets = require('./plugins/markets');

app.init().then(() => {
  try {
    const config = require('../config.js')
    app.addPlugin(markets(config));
  } catch (e) {
    console.error('Could not find config file');
  }
}).catch((e) => {
  console.error('Error starting up');
  console.error(e);
  process.exit(1);
});
