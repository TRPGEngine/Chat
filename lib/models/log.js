const uuid = require('uuid/v4');

module.exports = function Log(orm, db) {
  let ChatLog = db.define('chat_log', {
    uuid: {type: 'text', required: true},
    sender_uuid: {type: 'text', required: true},
    to_uuid: {type: 'text'},
    converse_uuid: {type: 'text'},
    message: {type: 'text', size: 1000},
    type: {type:'enum', values: ['normal', 'system', 'ooc', 'speak', 'action', 'cmd', 'card', 'tip']},
    data: {type:'object'},
    is_group: {type:'boolean', defaultValue: false},
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
