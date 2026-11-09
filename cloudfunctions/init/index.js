/**
 * 云函数：环境初始化（交付给他人时用）
 *
 * 别人拿走这份代码后，不需要手工建 9 个集合——调一次这个函数就行。
 * 索引和控制台权限没法用 SDK 设置，会以清单形式返回，照着在控制台点。
 *
 * action:
 *   schema     创建全部集合（已存在则跳过，可重复调用）
 *   indexes    返回索引清单（供人工在控制台新建）
 *   demo       为当前用户生成一套演示数据：房屋 + 房间勾选 + 家人 + 2 条订单
 *
 * 调用方式（二选一）：
 *   1. 云开发控制台 → 云函数 → init → 测试，入参 {"key":"...","action":"schema"}
 *   2. 小程序调试器 Console：
 *      wx.cloud.callFunction({ name:'init', data:{ key:'...', action:'demo' } })
 *
 * ⚠️ 正式上线前请删除本云函数，或至少改掉 INIT_KEY。
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 初始化口令。交付给别人时改掉，别用默认值。
 */
const INIT_KEY = 'AXIN-INIT-2026'

const COLLECTIONS = [
  'users',
  'homes',
  'home_access',
  'elders',
  'elder_bindings',
  'orders',
  'order_logs',
  'room_assets',
  'staff'
]

/**
 * 索引清单。createdAt / acceptedAt 用降序，列表按时间倒序查。
 * 唯一索引是防重复的关键：openid 重复会产生两个用户，房间资产重复会一张图变两张。
 */
const INDEXES = [
  { collection: 'users', name: 'uniq_openid', fields: [['openid', 'asc']], unique: true },
  { collection: 'elder_bindings', name: 'idx_user_status', fields: [['user_id', 'asc'], ['status', 'asc']], unique: false },
  { collection: 'elder_bindings', name: 'idx_elder_id', fields: [['elder_id', 'asc']], unique: false },
  { collection: 'orders', name: 'idx_user_id', fields: [['userId', 'asc']], unique: false },
  { collection: 'orders', name: 'idx_elder_created', fields: [['elderId', 'asc'], ['createdAt', 'desc']], unique: false },
  { collection: 'orders', name: 'idx_status', fields: [['status', 'asc']], unique: false },
  { collection: 'orders', name: 'idx_home_created', fields: [['homeId', 'asc'], ['createdAt', 'desc']], unique: false },
  { collection: 'orders', name: 'idx_staff_accepted', fields: [['staffId', 'asc'], ['acceptedAt', 'desc']], unique: false },
  { collection: 'order_logs', name: 'idx_order_id', fields: [['orderId', 'asc']], unique: false },
  { collection: 'homes', name: 'idx_owner', fields: [['ownerUserId', 'asc']], unique: false },
  { collection: 'home_access', name: 'idx_user_status', fields: [['userId', 'asc'], ['status', 'asc']], unique: false },
  { collection: 'home_access', name: 'uniq_home_user', fields: [['homeId', 'asc'], ['userId', 'asc']], unique: true },
  { collection: 'room_assets', name: 'uniq_home_room', fields: [['homeId', 'asc'], ['roomType', 'asc']], unique: true },
  { collection: 'staff', name: 'idx_user_status', fields: [['userId', 'asc'], ['status', 'asc']], unique: false }
]

/* ---------- schema ---------- */
async function createSchema() {
  const created = []
  const existed = []
  const failed = []

  for (let i = 0; i < COLLECTIONS.length; i++) {
    const name = COLLECTIONS[i]
    try {
      await db.createCollection(name)
      created.push(name)
    } catch (e) {
      const msg = String((e && e.message) || '')
      // 已存在不算失败，这样函数可以重复调用
      if (/already exist|-501001|exists/i.test(msg)) {
        existed.push(name)
      } else {
        failed.push({ name: name, message: msg })
      }
    }
  }

  return {
    ok: failed.length === 0,
    created: created,
    existed: existed,
    failed: failed,
    next: '集合就绪。接着调 action:"indexes" 拿索引清单，在控制台逐个新建。'
  }
}

/* ---------- demo ---------- */
async function demoData(user) {
  const now = Date.now()
  const result = { home: 0, rooms: 0, elders: 0, orders: 0 }

  // 1. 房屋
  let homeId = ''
  const access = await db.collection('home_access')
    .where({ userId: user._id, status: 'active' })
    .limit(1)
    .get()

  if (access.data.length > 0) {
    homeId = access.data[0].homeId
  } else {
    const added = await db.collection('homes').add({
      data: {
        name: '我的家',
        address: '示例路 88 号 2 单元 301',
        area: 89,
        floor: 3,
        elevator: false,
        remark: '示例数据，可自行修改',
        ownerUserId: user._id,
        createdAt: now,
        updatedAt: now
      }
    })
    homeId = added._id

    await db.collection('home_access').add({
      data: {
        homeId: homeId,
        userId: user._id,
        role: 'owner',
        relation: '本人',
        status: 'active',
        createdAt: now
      }
    })
    result.home = 1
  }

  // 2. 房间勾选（不塞照片，因为没有图片文件）
  const rooms = [
    { type: 'bathroom', checks: [0, 1, 3] },
    { type: 'bedroom', checks: [0] },
    { type: 'living', checks: [] }
  ]

  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i]
    const hit = await db.collection('room_assets')
      .where({ homeId: homeId, roomType: r.type })
      .limit(1)
      .get()

    if (hit.data.length === 0) {
      await db.collection('room_assets').add({
        data: {
          homeId: homeId,
          roomType: r.type,
          photoFileID: '',
          checks: r.checks,
          photoUpdatedAt: 0,
          checksUpdatedAt: now,
          createdAt: now
        }
      })
      result.rooms++
    }
  }

  // 3. 家人档案（含绑定关系，否则列表读不到）
  const elders = [
    { name: '张奶奶', relation: '母亲', age: 72, gender: '女', phone: '13800001111', note: '行动不便，浴室需要扶手' },
    { name: '李爷爷', relation: '父亲', age: 76, gender: '男', phone: '13800002222', note: '听力下降，沟通需大声' }
  ]

  const existElders = await db.collection('elders').limit(1).get()
  if (existElders.data.length === 0) {
    for (let i = 0; i < elders.length; i++) {
      const added = await db.collection('elders').add({
        data: Object.assign({}, elders[i], { createdAt: now, updatedAt: now })
      })
      await db.collection('elder_bindings').add({
        data: {
          elder_id: added._id,
          user_id: user._id,
          relation: elders[i].relation,
          permission: 'full',
          status: 'active',
          createdAt: now
        }
      })
      result.elders++
    }
  }

  // 4. 两条示例订单：一条待接单，一条已完成带评价
  const existOrders = await db.collection('orders').where({ userId: user._id }).limit(1).get()
  if (existOrders.data.length === 0) {
    const base = {
      userId: user._id,
      homeId: homeId,
      elderId: '',
      provider: '安心服务',
      quantity: 1,
      forWhom: '本人',
      contactName: user.nickname || '张奶奶',
      phone: '13800001111',
      address: '示例路 88 号 2 单元 301',
      familyPhone: '',
      bookedBy: '本人',
      records: [],
      media: [],
      staffId: '',
      staffName: '',
      staffPhone: '',
      staffUserId: '',
      acceptedAt: 0,
      arrivedAt: 0,
      finishedAt: 0,
      createdAt: now,
      updatedAt: now
    }

    const samples = [
      {
        orderNo: 'AX' + now + '001',
        roomType: 'bathroom',
        serviceId: 'repair',
        serviceName: '维修服务',
        icon: '🔧',
        unit: '次',
        price: 0,
        amount: 0,
        date: '2026-11-20',
        timeSlot: '上午 09:00',
        remark: '【浴室】加装扶手两根',
        status: '待接单'
      },
      {
        orderNo: 'AX' + now + '002',
        roomType: 'bedroom',
        serviceId: 'design',
        serviceName: '设计服务',
        icon: '🎨',
        unit: '次',
        price: 199,
        amount: 199,
        date: '2026-11-10',
        timeSlot: '下午 14:00',
        remark: '【卧室】夜间照明方案',
        status: '已完成',
        rating: 5,
        comment: '设计师很耐心，方案实用',
        ratedAt: now
      }
    ]

    for (let i = 0; i < samples.length; i++) {
      const added = await db.collection('orders').add({
        data: Object.assign({}, base, samples[i])
      })
      await db.collection('order_logs').add({
        data: {
          orderId: added._id,
          fromStatus: '',
          toStatus: samples[i].status === '待接单' ? '待接单' : '已完成',
          operatorId: user._id,
          operatorRole: 'system',
          note: '演示数据',
          createdAt: now
        }
      })
      result.orders++
    }
  }

  return {
    ok: true,
    created: result,
    message: '演示数据已生成，返回小程序刷新即可看到'
  }
}

/* ---------- 入口 ---------- */
exports.main = async (event) => {
  if (!event || event.key !== INIT_KEY) {
    return { ok: false, message: '初始化口令不对。请在云函数代码里查看 INIT_KEY' }
  }

  const action = event.action || 'schema'

  try {
    if (action === 'schema') {
      return await createSchema()
    }

    if (action === 'indexes') {
      return {
        ok: true,
        count: INDEXES.length,
        list: INDEXES,
        howto: '云开发控制台 → 数据库 → 选中集合 → 索引管理 → 新建索引。字段顺序不能反。'
      }
    }

    if (action === 'demo') {
      // 云端控制台调用时 OPENID 为空，允许显式传 openid，否则取最近注册的用户
      const openid = cloud.getWXContext().OPENID || event.openid || ''
      let user = null

      if (openid) {
        const res = await db.collection('users').where({ openid: openid }).limit(1).get()
        user = res.data[0] || null
      }

      if (!user) {
        const latest = await db.collection('users').orderBy('createdAt', 'desc').limit(1).get()
        user = latest.data[0] || null
      }

      if (!user) {
        return { ok: false, message: '还没有任何用户。请先在小程序里进一次首页（会触发登录），再执行本操作' }
      }

      return await demoData(user)
    }

    return { ok: false, message: '未知操作：' + action }
  } catch (e) {
    return { ok: false, message: '初始化失败：' + (e.message || '未知错误') }
  }
}
