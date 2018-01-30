const uuid = require('uuid/v4');

module.exports = function ChatConverse(orm, db) {
  let ChatConverse = db.define('chat_converse', {
    uuid: {type:'text', defaultValue: '', required: true},
    type: {type:'enum', values: ['user', 'channel', 'group', 'system'], defaultValue: 'user'},
    name: {type: 'text'},
    icon: {type: 'text'},
    members: {type: 'object', defaultValue: '[]'},// 仅会话为channel时可用。内容为uuid list
    createAt: {type: 'date',time: true},
  }, {
    validations: {
      uuid: orm.enforce.unique({ scope: ['owner_id'] }, 'uuid already taken!'),
    },
    hooks: {
      beforeCreate: function(next) {
        if (!this.uuid) {
  				this.uuid = uuid();
  			}
        if (!this.createAt) {
  				this.createAt = new Date();
  			}
  			return next();
      }
    },
    methods: {

    }
  });

  let User = db.models.player_user;
  if(!!User) {
    ChatConverse.hasMany('participants', User, {}, {reverse: 'converses', key: true});
  }

  return ChatConverse;
}
