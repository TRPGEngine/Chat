const app = require('../../Core/')();
const player = require('../../Player/');
const chat = require('../');

app.load(player);
app.load(chat);
app.run();
app.reset();
app.close();
