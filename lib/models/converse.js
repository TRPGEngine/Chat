module.exports = function ChatConverse(orm, db) {
  let ChatConverse = db.define('chat_converse', {
    uuid: {type:'text', defaultValue: '', required: true},
    type: {type:'enum', values: ['user', 'channel', 'group', 'system']},
    name: {type: 'text'},
    icon: {type: 'text'},
    members: {type: 'object', defaultValue: '[]'},// 仅会话为channel时可用。内容为uuid list
  }, {
    validations: {
      uuid: orm.enforce.unique({ scope: ['owner_id'] }, 'uuid already taken!'),
    },
    hooks: {

    },
    methods: {

    }
  });

  let User = db.models.player_user;
  if(!!User) {
    ChatConverse.hasOne('owner', User);
  }

  return ChatConverse;
}
