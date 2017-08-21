const uuid = require('uuid/v1');

module.exports = function Log(orm, db) {
  let ChatConverses = db.define('chat_converses', {
    uuid: {type:'text', defaultValue: ''},
    type: {type:'enum', values: ['user', 'group']},
    name: {type: 'text'},
    icon: {type: 'text'},
    lastMsg: {type: 'text'},
    lastTime: {type: 'date',time: true}
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

  let User = db.models.player_user;
  if(!!User) {
    ChatConverses.hasOne('owner', User, { reverse: "converses" });
  }

  return ChatConverses;
}
