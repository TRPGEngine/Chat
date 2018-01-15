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
  storage.registerModel(require('./models/converse.js'));

  app.on('initCompleted', function(app) {
    // 数据信息统计
    debug('storage has been load 2 chat db model');
  });
}

function initFunction() {
  let app = this;
  app.chat = {
    log: [],
    findMsgAsync: async function(msg_uuid) {
      for (var i = 0; i < app.chat.log.length; i++) {
        let log = app.chat.log[i];
        if(log.uuid === msg_uuid) {
          return log;
        }
      }

      let db = await app.storage.connectAsync();
      let res = await db.models.chat_log.oneAsync({uuid: msg_uuid});
      db.close();
      return res;
    },
    updateMsgAsync: async function(msg_uuid, msg) {
      for (var i = 0; i < app.chat.log.length; i++) {
        let log = app.chat.log[i];
        if(log.uuid === msg_uuid) {
          app.chat.log[i] = msg;
          return msg;
        }
      }

      let db = await app.storage.connectAsync();
      let res = await db.models.chat_log.oneAsync({uuid: msg_uuid});
      Object.assign(res, msg);
      res = await res.saveAsync();
      db.close();
      return res;
    },
    sendMsg: function(from_uuid, to_uuid, info) {
      // 不检测发送者uuid, 用于系统发送消息
      let room = info.room;
      let pkg = {
        message: info.message || '',
        room: room || '',
        sender_uuid: from_uuid,
        to_uuid: to_uuid,
        type: info.type || 'normal',
        is_public: info.is_public || false,
        data: info.data || null
      };
      debug('发送消息: [to %s] %o', to_uuid, pkg)

      let log = event.addChatLog.call(app, pkg);
      if(!pkg.is_public) {
        let other = app.player.list.get(to_uuid);
        if(!!other) {
          other.socket.emit('chat::message', log);
        }else {
          debug('[用户:%s]: 接收方%s不在线', from_uuid, to_uuid);
        }
      }else {
        // 群聊
        if(!room) {
          app.io.sockets.emit('chat::message', log);
        }else {
          let sender = app.player.list.get(from_uuid);
          if(sender) {
            sender.socket.broadcast.to(room).emit('chat::message', log);
          }else {
            app.io.sockets.in(room).emit('chat::message', log);
          }
        }
      }

      return log;
    },
    sendSystemMsg: function(to_uuid, type, title, content, mergeData) {
      let pkg = {
        message: content,
        room: '',
        type: 'card',
        is_public: false,
        data: Object.assign({}, {
          type: type,
          title: title,
          content: content
        }, mergeData),
      };
      if(type == '') {
        // 如果type为空，则发送普通信息
        pkg.type = 'normal';
        pkg.data = null;
      }
      debug('发送系统消息:');
      app.chat.sendMsg('trpgsystem', to_uuid, pkg);
    },
    sendSystemSimpleMsg: function(to_uuid, msg) {
      app.chat.sendSystemMsg(to_uuid, '', '', msg, null);
    },
    saveChatLogAsync: async function() {
      let logList = app.chat.log;
      let cacheList = Object.assign([], logList);
      logList.splice(0, cacheList.length);
      let db = await app.storage.connectAsync();
      let res = await db.models.chat_log.createAsync(cacheList);
      db.close();
      console.log("save chat log success!");
      return res;
    },
    getChatLogSumAsync: async function() {
      let db = await app.storage.connectAsync();
      let res = await db.models.chat_log.countAsync();
      db.close();
      return res;
    },
    getChatLogAsync: async function(page=1, limit=10) {
      let db = await app.storage.connectAsync();
      let res = await db.models.chat_log.find().offset((page-1)*limit).limit(limit).findAsync();
      db.close();
      return res;
    },
  };
}

function initSocket() {
  let app = this;
  app.registerEvent('chat::message', event.message);
  app.registerEvent('chat::getConverses', event.getConverses);
  app.registerEvent('chat::createConverse', event.createConverse);
  app.registerEvent('chat::removeConverse', event.removeConverse);
  app.registerEvent('chat::getChatLog', event.getChatLog);
  app.registerEvent('chat::updateCardChatData', event.updateCardChatData);
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
  app.register('resetStorage', async function(storage, db) {
    debug('start reset chat storage');
    if(!app.player) {
      setTimeout(function() {
        throw new Error('[ChatComponent] require component [PlayerComponent]');
      },200);
    }else {
      let users = await db.models.player_user.findAsync({id:[1,2]});
      let uuid1 = users[0].uuid;
      let uuid2 = users[1].uuid;
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

      // 系统消息
      let systemMsg = `${users[1].nickname || users[1].username} 想添加您为好友`;
      app.chat.sendSystemMsg(uuid1, 'friendInvite', '系统请求测试', systemMsg, {});
      app.chat.sendSystemMsg(uuid1, '', '系统普通测试', systemMsg, {});

      setTimeout(function() {
        console.log('发送测试信息');
        app.chat.sendMsg('trpgsystem', uuid1, {
          room: '',
          message: systemMsg,
          type: 'card',
          is_public: false,
          data: {
            title: '好友申请延时测试',
            type: 'friendInvite',
            content: systemMsg,
            uuid: uuid2,
          },
        })
      }, 20000);

      // 增加初始会话
      await db.models.chat_converse.createAsync({
        uuid: uuid2,
        type: 'user',
        name: users[1].username,
        icon: '',
        owner_id: users[0].id
      });
      await app.chat.saveChatLogAsync();// 存储聊天记录
    }
  });
}
