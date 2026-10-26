/**
 * 云函数：订单
 *
 * action:
 *   list        订单列表
 *   detail      订单详情（含流转日志）
 *   create      下单
 *   transition  状态流转（服务端校验状态机 + 操作者权限 + 写日志）
 *   addRecord   追加服务记录
 *   remove      删除（仅限已取消）
 *
 * 字段沿用客户端的驼峰命名，避免每层做映射。
 * 状态机 8 态，一律经 ALLOWED 表校验，不接受前端直接改 status。
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 一期演示开关：机构端和后台尚未上线，允许下单人以 staff 身份推进订单，
 * 便于本地跑通全链路。机构端上线后必须改为 false。
 */
const DEMO_MODE = true

const ALLOWED = {
  '待接单': { '已接单': ['staff'], '已拒单': ['staff'], '已取消': ['user', 'system'] },
  '已接单': { '服务中': ['staff'], '已取消': ['user', 'system'] },
  '服务中': { '待评价': ['staff'] },
  '待评价': { '已完成': ['user', 'system'] },
  '已完成': { '售后中': ['user'] },
  '已拒单': { '待接单': ['staff', 'system'] },
  '已取消': {},
  '售后中': {}
}

const ACTIVE_STATUS = ['待接单', '已接单', '服务中', '待评价']

function orderNo() {
  const d = new Date()
  function pad(n) { return n < 10 ? '0' + n : '' + n }
  const stamp = '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
    pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds())
  return 'AX' + stamp + Math.floor(Math.random() * 900 + 100)
}

async function currentUser(openid) {
  const res = await db.collection('users').where({ openid: openid }).limit(1).get()
  return res.data[0] || null
}

async function accessibleElderIds(userId) {
  const res = await db.collection('elder_bindings')
    .where({ user_id: userId, status: 'active' })
    .limit(100)
    .get()
  return res.data.map(function (b) { return b.elder_id })
}

async function canAccessOrder(user, order) {
  if (order.elderId) {
    const ids = await accessibleElderIds(user._id)
    return ids.indexOf(order.elderId) > -1
  }
  // 「本人」订单没有档案 ID，只对下单人可见
  return order.userId === user._id
}

async function loadOrder(id) {
  if (!id) return null
  const res = await db.collection('orders').doc(id).get().catch(function () { return null })
  return (res && res.data) || null
}

/* ---------- list ---------- */
async function list(user, filter) {
  const ids = await accessibleElderIds(user._id)

  // 可见性：本人下单的订单，或自己可访问的老人档案的订单
  const visible = ids.length === 0
    ? { userId: user._id }
    : _.or([{ userId: user._id }, { elderId: _.in(ids) }])

  let where = visible
  if (filter === 'ongoing') {
    where = _.and([visible, { status: _.in(ACTIVE_STATUS) }])
  } else if (filter === 'done') {
    where = _.and([visible, { status: _.in(['已完成', '已取消']) }])
  }

  const res = await db.collection('orders')
    .where(where)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()

  return { ok: true, list: res.data.map(function (o) { return Object.assign({}, o, { id: o._id }) }) }
}

/* ---------- detail ---------- */
async function detail(user, id) {
  const order = await loadOrder(id)
  if (!order) return { ok: false, message: '订单不存在' }
  if (!(await canAccessOrder(user, order))) return { ok: false, message: '无权查看该订单' }

  const logs = await db.collection('order_logs')
    .where({ orderId: id })
    .orderBy('createdAt', 'asc')
    .limit(100)
    .get()

  return { ok: true, order: Object.assign({}, order, { id: order._id }), logs: logs.data }
}

/* ---------- create ---------- */
async function create(user, input) {
  if (!input) return { ok: false, message: '缺少订单数据' }

  const need = ['serviceId', 'serviceName', 'contactName', 'phone', 'address', 'date', 'timeSlot']
  for (let i = 0; i < need.length; i++) {
    if (!input[need[i]]) return { ok: false, message: '必填项缺失：' + need[i] }
  }
  if (!/^1\d{10}$/.test(String(input.phone).trim())) {
    return { ok: false, message: '手机号格式不正确' }
  }

  if (input.elderId) {
    const ids = await accessibleElderIds(user._id)
    if (ids.indexOf(input.elderId) === -1) {
      return { ok: false, message: '无权为该老人下单' }
    }
  }

  const doc = {
    orderNo: orderNo(),
    userId: user._id,
    elderId: input.elderId || '',
    serviceId: input.serviceId,
    serviceName: input.serviceName,
    icon: input.icon || '',
    provider: input.provider || '',
    unit: input.unit || '',
    price: Number(input.price) || 0,
    quantity: Number(input.quantity) || 1,
    amount: Number(input.amount) || 0,
    forWhom: input.forWhom || '本人',
    contactName: String(input.contactName).trim(),
    phone: String(input.phone).trim(),
    address: String(input.address).trim(),
    date: input.date,
    timeSlot: input.timeSlot,
    remark: input.remark || '',
    familyPhone: input.familyPhone || '',
    bookedBy: input.bookedBy || '本人下单',
    status: '待接单',
    records: [],
    cancelReason: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  const added = await db.collection('orders').add({ data: doc })

  await db.collection('order_logs').add({
    data: {
      orderId: added._id,
      fromStatus: '',
      toStatus: '待接单',
      operatorId: user._id,
      operatorRole: 'user',
      note: '下单',
      createdAt: Date.now()
    }
  })

  return { ok: true, order: Object.assign({}, doc, { id: added._id }) }
}

/* ---------- transition ---------- */
async function transition(user, id, to, note, actor) {
  if (!id || !to) return { ok: false, message: '参数不完整' }

  const order = await loadOrder(id)
  if (!order) return { ok: false, message: '订单不存在' }
  if (!(await canAccessOrder(user, order))) return { ok: false, message: '无权操作该订单' }

  const targets = ALLOWED[order.status] || {}
  const actors = targets[to]
  if (!actors) {
    return { ok: false, message: '订单当前状态「' + order.status + '」不能变更为「' + to + '」' }
  }

  const realActor = actor || 'user'
  if (realActor === 'staff') {
    if (!DEMO_MODE && user.role !== 'staff' && user.role !== 'admin') {
      return { ok: false, message: '无权执行该操作' }
    }
    if (actors.indexOf('staff') === -1) {
      return { ok: false, message: '该转换不允许服务人员执行' }
    }
  } else if (actors.indexOf(realActor) === -1) {
    return { ok: false, message: '该转换不允许当前角色执行' }
  }

  const patch = { status: to, updatedAt: Date.now() }
  if (to === '已取消') patch.cancelReason = note || '用户主动取消'

  await db.collection('orders').doc(id).update({ data: patch })

  await db.collection('order_logs').add({
    data: {
      orderId: id,
      fromStatus: order.status,
      toStatus: to,
      operatorId: user._id,
      operatorRole: realActor,
      note: note || '',
      createdAt: Date.now()
    }
  })

  return { ok: true, order: Object.assign({}, order, patch, { id: id }) }
}

/* ---------- addRecord ---------- */
async function addRecord(user, id, content, worker) {
  if (!id || !content) return { ok: false, message: '请填写服务记录内容' }

  const order = await loadOrder(id)
  if (!order) return { ok: false, message: '订单不存在' }
  if (!(await canAccessOrder(user, order))) return { ok: false, message: '无权操作该订单' }

  const records = (order.records || []).concat([{
    id: 'R' + Date.now(),
    time: new Date().toLocaleString('zh-CN', { hour12: false }),
    worker: worker || '服务人员',
    content: content
  }])

  await db.collection('orders').doc(id).update({
    data: { records: records, updatedAt: Date.now() }
  })

  return { ok: true, order: Object.assign({}, order, { records: records, id: id }) }
}

/* ---------- remove ---------- */
async function remove(user, id) {
  const order = await loadOrder(id)
  if (!order) return { ok: false, message: '订单不存在' }
  if (order.status !== '已取消') return { ok: false, message: '只有已取消的订单可以删除' }
  if (!(await canAccessOrder(user, order))) return { ok: false, message: '无权操作该订单' }

  await db.collection('orders').doc(id).remove()
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
        return await list(user, event.filter)
      case 'detail':
        return await detail(user, event.id)
      case 'create':
        return await create(user, event.order)
      case 'transition':
        return await transition(user, event.id, event.to, event.note, event.actor)
      case 'addRecord':
        return await addRecord(user, event.id, event.content, event.worker)
      case 'remove':
        return await remove(user, event.id)
      default:
        return { ok: false, message: '未知操作：' + event.action }
    }
  } catch (e) {
    return { ok: false, message: '操作失败：' + (e.message || '服务异常') }
  }
}
