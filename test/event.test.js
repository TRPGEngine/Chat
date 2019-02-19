const event = require('../lib/event');
const db = global.db;
const testEvent = global.testEvent;
const emitEvent = global.emitEvent;
const socket = global.socket;

let listenedEvent = {};

function registerSocketListener(eventName, cb) {
  if(listenedEvent[eventName]) {
    // 加入事件列表
    listenedEvent[eventName].push(cb)
  }else{
    listenedEvent[eventName] = [cb];
    socket.on(eventName, (data) => {
      // 循环调用所有注册的事件回调
      if(listenedEvent[eventName]) {
        // 如果有该事件存在
        for (const fn of listenedEvent[eventName]) {
          fn(data);
        }
      }
    })
  }
}

describe('message action', () => {
  beforeAll(() => {
    this.shouldTriggerOnce = (eventName) => {
      return new Promise((resolve) => {
        registerSocketListener(eventName, (data) => {
          resolve(data);
        })
      })
    }
  })

  test.todo('message should be ok');
})

describe('chat event action', () => {
  let userInfo = {};
  let userInfoDbInstance = null;

  beforeAll(async () => {
    const loginInfo = await emitEvent('player::login', {
      username: 'admin1',
      password: '21232f297a57a5a743894a0e4a801fc3'
    })
    expect(loginInfo.result).toBe(true);
    userInfo = loginInfo.info

    userInfoDbInstance = await db.models.player_user.findOne({
      where: {uuid: userInfo.uuid}
    })
  })

  afterAll(async () => {
    await emitEvent('player::logout', {
      uuid: userInfo.uuid,
      token: userInfo.token
    })

    userInfo = {};
    userInfoDbInstance = null;
  })

  test('getConverses should be ok', async () => {
    let ret = await emitEvent('chat::getConverses');
    console.log('ret', ret);
  });
})
