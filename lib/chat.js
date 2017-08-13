const debug = require('debug')('trpg:component:chat');
const event = require('./event');

module.exports = function ChatComponent(app) {
  initStorage.call(app);
  initFunction.call(app);
  initSocket.call(app);
  initTimer.call(app);
}

function initStorage() {
  let app = this;
  let storage = app.storage;
  storage.registerModel(require('./models/log.js'));

  app.on('initCompleted', function(app) {
    // 数据信息统计
    debug('storage has been load 1 chat db model');
  });
}

function initFunction() {
  let app = this;
  app.chat = {
    log: [],
    getLog: function () {

    }
  };
}

function initSocket() {
  let app = this;
  app.on('connection', function(socket) {
    let wrap = {app, socket};
    socket.on('chat::message', event.message.bind(wrap));
  });
}

function initTimer() {
  let app = this;
  let timer = setInterval(function saveChat() {
    event.saveChatLog.call(app);
  }, 1000*60*10);

  app.on('close', function() {
    clearInterval(timer);
  });
}
