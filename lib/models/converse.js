module.exports = function ChatConverse(orm, db) {
  let ChatConverse = db.define('chat_converse', {
    uuid: {type:'text', defaultValue: '', required: true},
    type: {type:'enum', values: ['user', 'group', 'system']},
    name: {type: 'text'},
    icon: {type: 'text'},
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
