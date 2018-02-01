const debug = require('debug')('trpg:component:chat:event');
const generateUUID = require('uuid/v4');

let addChatLog = function addChatLog(messagePkg) {
  let app = this;
  let log = app.chat.log;
  if(!!log && !!messagePkg) {
    let pkg = {
      uuid: messagePkg.uuid || generateUUID(),
      sender_uuid: messagePkg.sender_uuid,
      to_uuid:messagePkg.to_uuid,
      converse_uuid:messagePkg.converse_uuid,
      message:messagePkg.message,
      type:messagePkg.type,
      is_group:messagePkg.is_group,
      is_public:messagePkg.is_public,
      date: messagePkg.date ? new Date(messagePkg.date) : new Date(),
      data: messagePkg.data,
    }
    log.push(pkg);

    // 检测会话创建 TODO
    // if(!app.chat.converses[pkg.converse_uuid]) {
    //   app.storage.connect(function(db) {
    //     db.models.chat_converse.create({}, function(err, conv) {
    //       if(!!err) {
    //         console.error(err);
    //       }else {
    //         app.chat.converses[conv.uuid] = conv;
    //       }
    //       db.close();
    //     })
    //   })
    // }else {
    //   let converse = app.chat.converses[pkg.converse_uuid];
    //   console.log( JSON.stringify(converse.participants));
    //   if(converse.members.indexOf(pkg.to_uuid) < 0) {
    //     // 添加接收方到会话中
    //     app.storage.connect(function(db) {
    //       db.models.player_user.one({
    //         uuid: pkg.to_uuid
    //       }, function(err, to_user) {
    //         if(!!err) {
    //           console.error(err);
    //         }else {
    //           if(!to_user) {
    //             debug('add to converse failed: not find user %s', pkg.to_uuid);
    //             db.close();
    //             return;
    //           }else {
    //             db.models.chat_converse.get(converse.id, function(err, converse) {
    //               if(!!err) {
    //                 console.error(err);
    //               }else {
    //                 converse.addParticipants([to_user], () => {});
    //                 converse.members.push(pkg.to_uuid);
    //                 converse.save(() => {});
    //               }
    //               db.close();
    //             })
    //           }
    //         }
    //       })
    //     })
    //
    //   }
    // }

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
  let converse_uuid = data.converse_uuid;
  let offsetDate = data.offsetDate || '';
  let limit = data.limit || 10;
  if(!converse_uuid) {
    cb({result: false, msg: '缺少必要参数'})
    return;
  }

  try {
    let list = [];
    let db = await app.storage.connectAsync();
    if(!offsetDate) {
      // 初始获取聊天记录
      let logs = await db.models.chat_log.find().order('-date').limit(limit).findAsync({converse_uuid});
      list = list.concat(logs);
      // 获取缓存中的聊天记录
      for (log of logList) {
        if(log.converse_uuid === converse_uuid) {
          list.push(log);
          continue;
        }
      }
    }else {
      let dateCond = app.storage._orm.lte(new Date(offsetDate));
      let logs = await db.models.chat_log.find().order('-date').limit(limit).findAsync({converse_uuid, date: dateCond});
      list = list.concat(logs);
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
    let sender_uuid = data.sender_uuid;
    let to_uuid = data.to_uuid;
    let converse_uuid = data.converse_uuid || sender_uuid;
    let type = data.type || 'normal';
    let is_public = data.is_public || false;
    let is_group = data.is_group || false;
    let date = data.date;
    let _uuid = generateUUID();
    let _data = data.data || null;
    let _pkg = {message, sender_uuid, to_uuid, converse_uuid, type, is_public, is_group, date, uuid: _uuid, data: _data};

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
        if(!is_group) {
          socket.broadcast.emit('chat::message', pkg);
        }else {
          socket.broadcast.to(converse_uuid).emit('chat::message', pkg);
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

let createConverse = async function createConverse(data, cb) {
  let app = this.app;
  let socket = this.socket;

  try {
    let player = app.player.list.find(socket);
    let user = player.user;
    if(!player) {
      cb({result: false, msg: '尚未登录'});
      return;
    }

    let db = await app.storage.connectAsync();
    let uuid = data.uuid;
    let type = data.type || 'user';
    let name = data.name;
    if(type === 'user') {
      let convUser = await db.models.player_user.oneAsync({uuid});
      if(!convUser) {
        cb({result: false, msg: '目标用户不存在'});
        db.close();
        return;
      }

      let converse = await db.models.chat_converse.createAsync({
        uuid: generateUUID(),
        type: data.type || 'user',
        name: name || '',
        icon: '',// 在之后可以对多人会话进行icon修改操作
        owner_id: user.id,
      });
      debug('create converse success: %s', JSON.stringify(converse));
      converse.addParticipants([user, convUser], () => {});
      app.chat.converses[converse.uuid] = Object.assign({}, converse);
      cb({result: true, data: converse});
    } if(type === 'group') {
      debug('创建用户组会话失败。尚未实现');
    } else {
      debug('create converse failed, try to create undefined type of converse: %o', data);
    }

    db.close();
  }catch(err) {
    cb({result: false, msg: err.toString()})
  }
}

let removeConverse = async function removeConverse(data, cb) {
  let app = this.app;
  let socket = this.socket;

  try {
    let player = app.player.list.find(socket);
    if(!player) {
      cb({result: false, msg: '发生异常，无法获取到用户信息，请检查您的登录状态'})
      return;
    }
    let user = player.user;
    let converse_uuid = data.converseUUID;
    let db = await app.storage.connectAsync();
    let converse = await db.models.chat_converse.oneAsync({'owner_id': user.id, 'uuid': converse_uuid});
    if(!converse) {
      cb({result: false, msg: '该会话不存在'})
      db.close();
      return;
    }

    await converse.removeAsync();
    cb({result: true})
    db.close();
  }catch(err) {
    cb({result: false, msg: err.toString()})
  }
}

let getConverses = async function getConverses(data, cb) {
  let app = this.app;
  let socket = this.socket;

  try {
    if(!app.player) {
      throw new Error('[ChatComponent] require component [PlayerComponent]');
    }

    let player = app.player.list.find(socket);
    if(!player) {
      cb({result: false, msg: '发生异常，无法获取到用户信息，请检查您的登录状态'})
      return;
    }
    let user = player.user;
    let db = await app.storage.connectAsync();
    let converses = await user.getConversesAsync();
    converses.push({
      uuid: 'trpgsystem',
      type: 'system',
      name: '系统消息',
      icon: '',
    })
    cb({result: true, list: converses});
    db.close();
  }catch(err) {
    cb({result: false, msg: err.toString()})
  }
}

let updateCardChatData = async function updateCardChatData(data, cb) {
  let app = this.app;
  let socket = this.socket;

  try {
    let player = app.player.list.find(socket);
    if(!player) {
      cb({result: false, msg: '发生异常，无法获取到用户信息，请检查您的登录状态'})
      return;
    }

    let { chatUUID, newData } = data;
    let log = null;
    // 在内存中查找
    let logs = app.chat.log;
    for (let l of logs) {
      if(l.uuid === chatUUID && l.type === 'card' && (l.sender_uuid === player.uuid || l.to_uuid === player.uuid)) {
        log = l;
      }
    }

    if(!!log) {
      // 在内存中找到
      log.data = Object.assign({}, log.data, newData);
      cb({result: true, log});
    }else {
      // 在数据库中查找
      let db = await app.storage.connectAsync();
      log = await db.models.chat_log.oneAsync({
        uuid: chatUUID,
        type: 'card',
        or: [
          { sender_uuid: player.uuid },
          { to_uuid: player.uuid },
        ],
      });
      if(!log) {
        db.close();
        cb({result: false, msg: '找不到该条系统信息'});
        return;
      }

      log.data = Object.assign({}, log.data, newData);
      log.saveAsync();
      cb({result: true, log});
    }
  }catch(e) {
    cb({result: false, msg: e.toString()})
  }
}

exports.addChatLog = addChatLog;
exports.saveChatLog = saveChatLog;
exports.message = message;
exports.getConverses = getConverses;
exports.createConverse = createConverse;
exports.removeConverse = removeConverse;
exports.getChatLog = getChatLog;
exports.updateCardChatData = updateCardChatData;
