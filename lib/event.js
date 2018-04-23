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

// 弃用
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

let getUserChatLog = async function getUserChatLog(data, cb, db) {
  let app = this.app;
  let socket = this.socket;
  let logList = app.chat.log;
  let userUUID = data.user_uuid;
  let offsetDate = data.offsetDate || '';
  let limit = data.limit || 10;

  if(!userUUID) {
    throw '缺少必要参数';
  }

  let player = app.player.list.find(socket);
  if(!player) {
    throw '尚未登录';
  }
  let selfUUID = player.uuid;
  let conditions = {
    converse_uuid: null,
    or: [
      {sender_uuid: userUUID, to_uuid: selfUUID},
      {sender_uuid: selfUUID, to_uuid: userUUID},
    ]
  }

  let list = [];
  if(!offsetDate) {
    // 初始获取聊天记录
    let logs = await db.models.chat_log.find().order('-date').limit(limit).findAsync(conditions);
    list = list.concat(logs);
    // 获取缓存中的聊天记录
    for (log of logList) {
      if(!log.converse_uuid && (log.sender_uuid === userUUID && log.to_uuid === selfUUID || log.sender_uuid === selfUUID && log.to_uuid === userUUID)) {
        list.push(log);
        continue;
      }
    }
  }else {
    conditions['date'] = app.storage._orm.lte(new Date(offsetDate));
    let logs = await db.models.chat_log.find().order('-date').limit(limit).findAsync(conditions);
    list = list.concat(logs);
  }
  cb({result: true, list});
}

let getConverseChatLog = async function getConverseChatLog(data, cb, db) {
  let app = this.app;
  let socket = this.socket;
  let logList = app.chat.log;
  let converse_uuid = data.converse_uuid;
  let offsetDate = data.offsetDate || '';
  let limit = data.limit || 10;
  if(!converse_uuid) {
    throw '缺少必要参数';
  }

  let player = app.player.list.find(socket);
  if(!player) {
    throw '尚未登录';
  }
  let selfUUID = player.uuid;

  let list = [];
  let conditions = {
    converse_uuid,
    or: [
      {to_uuid: null},
      {to_uuid: ''},
      {to_uuid: selfUUID}
    ]
  }
  if(!offsetDate) {
    // 初始获取聊天记录
    let logs = await db.models.chat_log.find().order('-date').limit(limit).findAsync(conditions);
    list = list.concat(logs);
    // 获取缓存中的聊天记录
    for (log of logList) {
      if(log.converse_uuid === converse_uuid && (!to_uuid || to_uuid == selfUUID)) {
        list.push(log);
        continue;
      }
    }
  }else {
    conditions.date = app.storage._orm.lte(new Date(offsetDate));
    let logs = await db.models.chat_log.find().order('-date').limit(limit).findAsync(conditions);
    list = list.concat(logs);
  }
  cb({result: true, list});
}

let getAllUserConverse = async function getAllUserConverse(data, cb, db) {
  let app = this.app;
  let socket = this.socket;

  let player = app.player.list.find(socket);
  if(!player) {
    throw '尚未登录';
  }

  let ret = await db.models.chat_log.aggregate({
    sender_uuid: app.storage._orm.not_like('trpg%'),
    to_uuid: player.uuid,
    converse_uuid: null,
    is_group: false,
  }).distinct('sender_uuid').getAsync();
  cb({result: true, senders: ret[0]});
}

let getOfflineUserConverse = async function getOfflineUserConverse(data, cb, db) {
  let app = this.app;
  let socket = this.socket;
  let lastLoginDate = data.lastLoginDate;
  if(!lastLoginDate) {
    throw '缺少必要参数';
  }

  let player = app.player.list.find(socket);
  if(!player) {
    throw '尚未登录';
  }

  let dateCond = app.storage._orm.gte(new Date(lastLoginDate));
  let ret = await db.models.chat_log.aggregate({
    sender_uuid: app.storage._orm.not_like('trpg%'),
    to_uuid: player.uuid,
    converse_uuid: null,
    date: dateCond,
    is_group: false,
  }).distinct('sender_uuid').getAsync();
  cb({result: true, senders: ret[0]});
}

let message = function message(data, cb) {
  let app = this.app;
  let socket = this.socket;
  if(!!app.player) {
    let player = app.player;
    let message = data.message;
    let sender_uuid = data.sender_uuid;
    let to_uuid = data.to_uuid;
    let converse_uuid = data.converse_uuid;
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

// 会话创建用于多人会话, 创建团以后自动生成一个团会话
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
      // app.chat.converses[converse.uuid] = Object.assign({}, converse);
      app.chat.addConverse()
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
// exports.getChatLog = getChatLog;
exports.getUserChatLog = getUserChatLog;
exports.getConverseChatLog = getConverseChatLog;
exports.getAllUserConverse = getAllUserConverse;
exports.getOfflineUserConverse = getOfflineUserConverse;
exports.updateCardChatData = updateCardChatData;
