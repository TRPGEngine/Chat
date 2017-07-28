const debug = require('debug')('trpg:component:chat:event');

exports.message = function message(data, cb) {
  let msg = data.msg;
  let room = data.room;

  if(!!msg) {
    if(!room) {
      socket.broadcast.emit('chat::message', {msg});
      cb({result: true, msg});
    }else {
      socket.broadcast.to(room).emit('chat::message', {msg, room});
      cb({result: true, msg, room});
    }

  }else {
    cb({result: false, msg: '聊天内容不能为空'});
  }
}
