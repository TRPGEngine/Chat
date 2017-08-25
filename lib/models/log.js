const uuid = require('uuid/v4');

module.exports = function Log(orm, db) {
  let ChatLog = db.define('chat_log', {
    uuid: {type: 'text', required: false},
    sender_uuid: {type: 'text', required: false},
    to_uuid: {type: 'text', required: false},
    room: {type: 'text'},
    message: {type: 'text'},
    type: {type:'enum', values: ['normal', 'system', 'ooc', 'speak', 'action', 'cmd']},
    is_public: {type:'boolean', defaultValue: true},
    date: {type: 'date',time: true}
  }, {
    hooks: {
      beforeCreate: function(next) {
        if (!this.uuid) {
  				this.uuid = uuid();
  			}
  			return next();
      }
    },
    methods: {

    }
  });

  return ChatLog;
}
