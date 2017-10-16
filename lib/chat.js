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
    sendMsg: function(from_uuid, to_uuid, info) {
      // 不检测发送者uuid, 用于系统发送消息
      let pkg = {
        message: info.message || '',
        room: info.room || '',
        sender_uuid: from_uuid,
        to_uuid: to_uuid,
        type: info.type || 'normal',
        is_public: info.is_public || false,
        data: info.data || null
      };

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
          app.io.sockets.in(room).emit('chat::message', log);
        }
      }
    },
    sendSystemMsg: function(to_uuid, type, title, content, mergeData) {
      app.chat.sendMsg('trpgsystem', to_uuid, {
        message: content,
        room: '',
        type: 'card',
        is_public: false,
        data: Object.assign({}, {
          type: type,
          title: title,
          content: content
        }, mergeData),
      })
    }
  };
}

function initSocket() {
  let app = this;
  app.on('connection', function(socket) {
    let wrap = {app, socket};
    socket.on('chat::message', event.message.bind(wrap));
    socket.on('chat::getConverses', event.getConverses.bind(wrap));
    socket.on('chat::createConverse', event.createConverse.bind(wrap));
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

      setTimeout(function() {
        console.log('发送信息');
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
      event.saveChatLog.call(app);// 存储聊天记录
    }
  });
}
