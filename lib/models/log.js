const uuid = require('uuid/v1');

module.exports = function Log(orm, db) {
  let ChatLog = db.define('chat_log', {
    sender_uuid: {type: 'text', required: true},
    to_uuid: {type: 'text', required: false},
    uuid: {type: 'text', required: true, defaultValue: uuid()},
    message: {type: 'object'},
    message_type: {type:'enum', values: ['normal', 'system', 'ooc', 'act', 'cmd']},
    date: {type: 'date',time: true, defaultValue: new Date()}
  }, {
    methods: {

    }
  });

  let Actor = db.models.player_actor;
  if(!!Actor) {
    ChatLog.hasOne('sender', Actor);
  }

  return ChatLog;
}
