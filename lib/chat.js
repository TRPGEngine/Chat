const debug = require('debug')('trpg:component:chat');
const event = require('./event');

module.exports = function ChatComponent(app) {
  initStorage.call(app);
  initFunction.call(app);
  initSocket.call(app);
  initTimer.call(app);
  initReset.call(app);
}

function initStorage() {
  let app = this;
  let storage = app.storage;
  storage.registerModel(require('./models/log.js'));
  storage.registerModel(require('./models/converses.js'));

  app.on('initCompleted', function(app) {
    // 数据信息统计
    debug('storage has been load 2 chat db model');
  });
}

function initFunction() {
  let app = this;
  app.chat = {
    log: [],
    getLog: function () {

    },
    getConverse: function(uuid, type) {
      if(type === 'user') {

      }else if(type === 'group') {

      }
    }
  };
}

function initSocket() {
  let app = this;
  app.on('connection', function(socket) {
    let wrap = {app, socket};
    socket.on('chat::message', event.message.bind(wrap));
    socket.on('chat::getConverses', event.getConverses.bind(wrap));
    socket.on('chat::getChatLog', event.getChatLog.bind(wrap));
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

function initReset() {
  let app = this;
  app.on('resetStorage', function(storage, db) {
    debug('start reset chat storage');
    if(!!app.player) {
      setTimeout(function() {
        db.models.player_user.find({id:[1,2]}, function(err, players) {
          let uuid1 = players[0].uuid;
          let uuid2 = players[1].uuid;
          const addChatLog = event.addChatLog.bind(app);
          addChatLog({
            sender_uuid: uuid1,
            to_uuid:uuid2,
            room:'',
            message:'你好啊',
            type:'normal',
            is_public:true,
          });
          addChatLog({
            sender_uuid: uuid1,
            to_uuid:uuid2,
            room:'',
            message:'在么',
            type:'normal',
            is_public:true,
          });
          addChatLog({
            sender_uuid: uuid2,
            to_uuid:uuid1,
            room:'',
            message:'你也好啊',
            type:'normal',
            is_public:true,
          });
          addChatLog({
            sender_uuid: uuid1,
            to_uuid:uuid2,
            room:'',
            message:'我们来跑团吧？',
            type:'normal',
            is_public:true,
          });
          addChatLog({
            sender_uuid: uuid2,
            to_uuid:uuid1,
            room:'',
            message:'好啊好啊',
            type:'normal',
            is_public:true,
          });

          event.saveChatLog.call(app);
        })
      },200);
    }else {
      throw new Error('[ChatComponent] require component [PlayerComponent]');
    }
  });
}
