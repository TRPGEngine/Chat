const debug = require('debug')('trpg:component:chat:event');
const uuid = require('uuid/v4');

let addChatLog = function addChatLog(messagePkg) {
  let app = this;
  let log = app.chat.log;
  if(!!log && !!messagePkg) {
    log.push({
      uuid: messagePkg.uuid,
      sender_uuid: messagePkg.sender_uuid,
      to_uuid:messagePkg.to_uuid,
      room:messagePkg.room,
      message:messagePkg.message,
      type:messagePkg.type,
      is_public:messagePkg.is_public,
      date: messagePkg.date || new Date().getTime(),
      data: messagePkg.data,
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
    Log.create(cacheList, function(err) {
      if(!!err) {
        console.warn('saveChatLog Error:', err);
      }
    })
  });

  debug('chat log auto saving...');
}

let getChatLog = function getChatLog(data, cb) {
  let app = this.app;
  let logList = app.chat.log;
  let {uuid1, uuid2} = data;
  if(!!uuid1 && !!uuid2) {
    let list = [];
    // 获取数据库中的log记录
    app.storage.connect(function(db) {
      let Log = db.models.chat_log;
      Log.find({or:[
        {sender_uuid:uuid1,to_uuid:uuid2},
        {sender_uuid:uuid2,to_uuid:uuid1},
      ]}, function(err, res) {
        if(!!err) {
          console.warn('getChatLog Error:', err);
          cb({result: false, msg: err.toString()});
          return;
        }
        list = list.concat(res);

        // 获取缓存中的聊天记录
        for (log of logList) {
          if((log.sender_uuid === uuid1 && log.to_uuid === uuid2) || (log.sender_uuid === uuid2 && log.to_uuid === uuid1)) {
            list.push(log);
          }
        }
        cb({result: true, list});
      })
    });
  }else {
    cb({result: false, msg: '参数不全'});
  }
}

let message = function message(data, cb) {
  let app = this.app;
  let socket = this.socket;
  if(!!app.player) {
    let player = app.player;
    let message = data.message;
    let room = data.room;
    let sender_uuid = data.sender_uuid;
    let to_uuid = data.to_uuid || '';
    let type = data.type || 'normal';
    let is_public = data.is_public || false;
    let _uuid = uuid();
    let pkg = {message, room, sender_uuid, to_uuid, type, is_public, uuid: _uuid};

    debug('[用户#%s]: %s', sender_uuid, message);
    if(!!message) {
      if(!is_public) {
        // 私聊
        let other = player.list.get(to_uuid);
        if(!!other) {
          other.socket.emit('chat::message', pkg);
        }else {
          debug('[用户:%s]: 接收方%s不在线', sender_uuid, to_uuid);
        }
      } else {
        // 群聊
        if(!room) {
          socket.broadcast.emit('chat::message', pkg);
        }else {
          socket.broadcast.to(room).emit('chat::message', pkg);
        }
      }
      cb({result: true, pkg});
      addChatLog.call(app, pkg);
    } else {
      cb({result: false, msg: '聊天内容不能为空'});
    }
  }else{
    throw new Error('[ChatComponent] require component [PlayerComponent]');
  }
}

let createConverse = function createConverse(data, cb) {
  let app = this.app;
  let socket = this.socket;

  if(!!app.player) {
    let player = app.player.list.find(socket);
    if(!!player) {
      let user = player.user;
      app.storage.connect(function(db) {
        const ChatConverse = db.models.chat_converse;
        const PlayerUser = db.models.player_user;
        let uuid = data.uuid;
        let type = data.type || 'user';
        if(type === 'user') {
          app.player.find(uuid, function(err, results) {
            if(!!err) {
              debug('throw error on createConverse: %O', err);
              cb({result: false, msg: err.toString()})
            }else {
              let convUser = results[0];
              if(!convUser) {
                cb({result: false, msg: '目标用户不存在'});
              }else {
                console.log(JSON.stringify(convUser));
                ChatConverse.create({
                  uuid: data.uuid,
                  type: data.type || 'user',
                  name: convUser.nickname || convUser.username,
                  icon: convUser.avatar || '',
                  owner_id: user.id,
                }, function(err, conv) {
                  if(!!err) {
                    cb({result: false, msg: err.toString()});
                  }else {
                    debug('create converse success: %s', JSON.stringify(conv));
                    cb({result: true, data: conv});
                  }
                })
              }
            }
          })
        }else if(type === 'group') {
          debug('创建用户组会话失败。尚未实现');
        }else {
          debug('create converse failed, try to create undefined type of converse: %o', data);
        }
      });
    }else {
      cb({result: false, msg: '尚未登录'});
    }
  }else {
    throw new Error('[ChatComponent] require component [PlayerComponent]');
  }
}

let getConverses = function getConverses(data, cb) {
  let app = this.app;
  let socket = this.socket;

  if(!!app.player) {
    let player = app.player.list.find(socket);
    if(!!player) {
      let user = player.user;
      app.storage.connect(function(db) {
        const ChatConverse = db.models.chat_converse;
        ChatConverse.find({'owner_id': user.id}, function(err, converses) {
          if(!!err) {
            debug('throw error on getConverses: %O', err);
            cb({result: false, msg: err.toString()})
          }else {
            converses.push({
              uuid: 'trpgsystem',
              type: 'system',
              name: '系统消息',
              icon: '',
            })
            cb({result: true, list: converses});
          }
        });
      });
    }else {
      cb({result: false, msg: '发生异常，无法获取到用户信息，请检查您的登录状态'})
    }
  }else {
    throw new Error('[ChatComponent] require component [PlayerComponent]');
  }
}

exports.addChatLog = addChatLog;
exports.saveChatLog = saveChatLog;
exports.message = message;
exports.getConverses = getConverses;
exports.createConverse = createConverse;
exports.getChatLog = getChatLog;
