const debug = require('debug')('trpg:component:chat:event');
const uuid = require('uuid/v4');

let addChatLog = function addChatLog(messagePkg) {
  let app = this;
  let log = app.chat.log;
  if(!!log && !!messagePkg) {
    let pkg = {
      uuid: messagePkg.uuid || uuid(),
      sender_uuid: messagePkg.sender_uuid,
      to_uuid:messagePkg.to_uuid,
      room:messagePkg.room,
      message:messagePkg.message,
      type:messagePkg.type,
      is_public:messagePkg.is_public,
      date: messagePkg.date ? new Date(messagePkg.date) : new Date(),
      data: messagePkg.data,
    }
    log.push(pkg);
    return pkg;
  }else {
    return false;
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
      db.close();
      if(!!err) {
        console.warn('saveChatLog Error:', err);
      }
    })
  });

  debug('chat log auto saving...');
}

let getChatLog = async function getChatLog(data, cb) {
  let app = this.app;
  let logList = app.chat.log;
  let {uuid1, uuid2, room} = data;
  if((!uuid1 || !uuid2) && !room) {
    cb({result: false, msg: '缺少必要参数'})
    return;
  }
  let conditions = {};
  if(!!room) {
    conditions['room'] = room;
    if(!!uuid1 && !!uuid2) {
      conditions['or'] = [
        {sender_uuid:uuid1,to_uuid:uuid2},
        {sender_uuid:uuid2,to_uuid:uuid1},
      ]
    }
  }else {
    conditions['or'] = [
      {sender_uuid:uuid1,to_uuid:uuid2},
      {sender_uuid:uuid2,to_uuid:uuid1},
    ]
  }

  try {
    let list = [];
    let db = await app.storage.connectAsync();
    let logs = await db.models.chat_log.findAsync(conditions);
    list = list.concat(logs);
    // 获取缓存中的聊天记录
    for (log of logList) {
      if(!!conditions['or']) {
        if((log.sender_uuid === uuid1 && log.to_uuid === uuid2) || (log.sender_uuid === uuid2 && log.to_uuid === uuid1)) {
          list.push(log);
          continue;
        }
      }

      if(!!conditions['room']) {
        if(log.room === room) {
          list.push(log);
          continue;
        }
      }
    }
    cb({result: true, list});
    db.close();
  }catch (err) {
    cb({result: false, msg: err.toString()})
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
    let _data = data.data || null;
    let _pkg = {message, room, sender_uuid, to_uuid, type, is_public, uuid: _uuid, data: _data};

    debug('[用户#%s]: %s', sender_uuid, message);
    if(!!message) {
      let pkg = addChatLog.call(app, _pkg);
      if(!pkg) {
        cb({result: false, msg: '信息服务出现异常'});
        return;
      }

      if(!is_public) {
        if(sender_uuid !== to_uuid) {
          // 私聊
          let other = player.list.get(to_uuid);
          if(!!other) {
            other.socket.emit('chat::message', pkg);
          }else {
            debug('[用户:%s]: 接收方%s不在线', sender_uuid, to_uuid);
          }
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
              db.close();
            }else {
              let convUser = results[0];
              if(!convUser) {
                cb({result: false, msg: '目标用户不存在'});
                db.close();
              }else {
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
                  db.close();
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
          db.close();
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
