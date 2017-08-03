const debug = require('debug')('trpg:component:chat:event');

let addChatLog = function addChatLog(messagePkg) {
  let app = this;
  let log = app.chat.log;
  if(!!log && !!messagePkg) {
    log.push({
      sender_uuid: messagePkg.sender,
      to_uuid:messagePkg.to,
      room:messagePkg.room,
      message:messagePkg.msg,
      type:messagePkg.type,
      is_public:messagePkg.isPublic,
      date: new Date().getTime()
    });
  }
}

let saveChatLog = function saveChatLog() {
  let app = this;
  let logList = app.chat.log;
  let cacheList = Object.assign([], logList);// 缓存区
  logList.splice(0, cacheList.length);
  app.storage.connect(function(db) {
    let Log = db.models.chat_log;
    while(cacheList.length > 0) {
      let pkg = cacheList.shift();
      Log.create(pkg, function(err) {
        if(!!err) {
          console.warn('saveChatLog Error:', err);
        }
      })
    }
  });

  debug('chat log auto saving...');
}

let message = function message(data, cb) {
  let app = this.app;
  let socket = this.socket;
  if(!!app.player) {
    // app player
    let msg = data.msg;
    let room = data.room;
    let sender = data.sender;
    let to = data.to || '';
    let type = data.type || 'normal';
    let isPublic = data.isPublic || true;
    let pkg = {msg, room, sender, to, type, isPublic};

    if(!!msg) {
      if(!isPublic) {
        // TODO 私聊
      } else {
        if(!room) {
          socket.broadcast.emit('chat::message', {msg, type});
        }else {
          socket.broadcast.to(room).emit('chat::message', {msg, room});
        }
        cb(Object.assign({}, {result: true}, pkg));
      }
      addChatLog.call(app, pkg);
    } else {
      cb({result: false, msg: '聊天内容不能为空'});
    }
  }else{
    throw new Error('[ChatComponent] require component [PlayerComponent]');
  }
}

exports.addChatLog = addChatLog;
exports.saveChatLog = saveChatLog;
exports.message = message;
