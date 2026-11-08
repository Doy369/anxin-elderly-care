/**
 * 云函数：房屋
 *
 * 一人可管理多套房屋，一套房屋可被多人共管（子女 + 老人）。
 * 房屋是房间照片、隐患勾选、订单的归属主体——不挂在账号上。
 *
 * action:
 *   list    我可见的房屋（没有则自动建一套默认）
 *   create  新增房屋
 *   update  修改房屋信息
 *   remove  删除房屋（仅 owner，且无进行中订单）
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const MAX_HOMES = 5
const ACTIVE_ORDER = ['待接单', '已接单', '服务中', '待评价']

async function currentUser(openid) {
  const res = await db.collection('users').where({ openid: openid }).limit(1).get()
  return res.data[0] || null
}

async function getAccess(userId, homeId) {
  const res = await db.collection('home_access')
    .where({ homeId: homeId, userId: userId, status: 'active' })
    .limit(1)
    .get()
  return res.data[0] || null
}

function normalize(data) {
  return {
    name: String(data.name || '我的家').trim().slice(0, 20),
    address: String(data.address || '').trim().slice(0, 100),
    area: data.area ? Number(data.area) : 0,
    floor: data.floor ? Number(data.floor) : 0,
    elevator: !!data.elevator,
    remark: String(data.remark || '').trim().slice(0, 50)
  }
}

/* ---------- list ---------- */
async function list(user) {
  const access = await db.collection('home_access')
    .where({ userId: user._id, status: 'active' })
    .limit(MAX_HOMES)
    .get()

  // 首次使用自动建一套，避免空状态挡住后续流程
  if (access.data.length === 0) {
    const created = await create(user, { name: '我的家' })
    if (created.ok === false) return created
    return { ok: true, list: [created.home] }
  }

  const ids = access.data.map(function (a) { return a.homeId })
  const homes = await db.collection('homes').where({ _id: _.in(ids) }).limit(MAX_HOMES).get()

  const roleMap = {}
  access.data.forEach(function (a) { roleMap[a.homeId] = a.role })

  const order = {}
  ids.forEach(function (id, i) { order[id] = i })

  const listData = homes.data.map(function (h) {
    return Object.assign({}, h, { id: h._id, role: roleMap[h._id] || 'member' })
  }).sort(function (a, b) {
    return (order[a.id] || 0) - (order[b.id] || 0)
  })

  return { ok: true, list: listData }
}

/* ---------- create ---------- */
async function create(user, data) {
  const count = await db.collection('home_access')
    .where({ userId: user._id, status: 'active' })
    .count()

  if (count.total >= MAX_HOMES) {
    return { ok: false, message: '最多添加 ' + MAX_HOMES + ' 套房屋' }
  }

  const doc = Object.assign(normalize(data || {}), {
    ownerUserId: user._id,
    createdAt: Date.now(),
    updatedAt: Date.now()
  })

  const added = await db.collection('homes').add({ data: doc })

  await db.collection('home_access').add({
    data: {
      homeId: added._id,
      userId: user._id,
      role: 'owner',
      relation: '本人',
      status: 'active',
      createdAt: Date.now()
    }
  })

  return { ok: true, home: Object.assign({}, doc, { id: added._id, role: 'owner' }) }
}

/* ---------- update ---------- */
async function update(user, homeId, data) {
  if (!homeId) return { ok: false, message: '缺少房屋 ID' }
  const access = await getAccess(user._id, homeId)
  if (!access) return { ok: false, message: '无权修改该房屋' }

  const patch = normalize(data || {})
  patch.updatedAt = Date.now()

  await db.collection('homes').doc(homeId).update({ data: patch })
  return { ok: true, home: Object.assign({ id: homeId }, patch) }
}

/* ---------- remove ---------- */
async function remove(user, homeId) {
  if (!homeId) return { ok: false, message: '缺少房屋 ID' }
  const access = await getAccess(user._id, homeId)
  if (!access) return { ok: false, message: '无权删除该房屋' }
  if (access.role !== 'owner') {
    return { ok: false, message: '只有房主可以删除房屋' }
  }

  const running = await db.collection('orders')
    .where({ homeId: homeId, status: _.in(ACTIVE_ORDER) })
    .count()
  if (running.total > 0) {
    return { ok: false, message: '这套房子还有进行中的订单，请先完成或取消' }
  }

  await db.collection('homes').doc(homeId).remove()
  await db.collection('room_assets').where({ homeId: homeId }).remove()
  await db.collection('home_access')
    .where({ homeId: homeId })
    .update({ data: { status: 'removed' } })

  return { ok: true }
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return { ok: false, message: '无法获取用户身份' }

  const user = await currentUser(openid)
  if (!user) return { ok: false, message: '用户不存在，请重新进入小程序' }

  try {
    switch (event.action) {
      case 'list':
        return await list(user)
      case 'create':
        return await create(user, event.data)
      case 'update':
        return await update(user, event.homeId, event.data)
      case 'remove':
        return await remove(user, event.homeId)
      default:
        return { ok: false, message: '未知操作：' + event.action }
    }
  } catch (e) {
    return { ok: false, message: '操作失败：' + (e.message || '服务异常') }
  }
}
