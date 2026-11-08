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

async function accessibleHomeIds(userId) {
  const res = await db.collection('home_access')
    .where({ userId: userId, status: 'active' })
    .limit(20)
    .get()
  return res.data.map(function (a) { return a.homeId })
}

async function getStaff(user) {
  const res = await db.collection('staff')
    .where({ userId: user._id, status: 'active' })
    .limit(1)
    .get()
  return res.data[0] || null
}

async function canAccessOrder(user, order) {
  // 被指派的师傅可以看自己的单
  if (order.staffId) {
    const staff = await getStaff(user)
    if (staff && order.staffId === staff._id) return true
  }
  // 房屋是主归属：同一套房的共管人都能看到订单
  if (order.homeId) {
    const homes = await accessibleHomeIds(user._id)
    return homes.indexOf(order.homeId) > -1
  }
  if (order.elderId) {
    const ids = await accessibleElderIds(user._id)
    return ids.indexOf(order.elderId) > -1
  }
  // 「本人」订单没有档案和房屋，只对下单人可见
  return order.userId === user._id
}

async function loadOrder(id) {
  if (!id) return null
  const res = await db.collection('orders').doc(id).get().catch(function () { return null })
  return (res && res.data) || null
}

/* ---------- list ---------- */
async function list(user, filter) {
  const elderIds = await accessibleElderIds(user._id)
  const homeIds = await accessibleHomeIds(user._id)

  // 可见性：本人下单 / 可访问的老人档案 / 可访问的房屋
  const ors = [{ userId: user._id }]
  if (elderIds.length > 0) ors.push({ elderId: _.in(elderIds) })
  if (homeIds.length > 0) ors.push({ homeId: _.in(homeIds) })

  const visible = ors.length === 1 ? ors[0] : _.or(ors)

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

  let accessible = await canAccessOrder(user, order)
  let masked = false

  // 师傅要能先看单再接。未接的单只给看，联系方式打码。
  if (!accessible) {
    const staff = await getStaff(user)
    if (staff && order.status === '待接单' && !order.staffId) {
      accessible = true
      masked = true
    }
  }

  if (!accessible) return { ok: false, message: '无权查看该订单' }

  const logs = await db.collection('order_logs')
    .where({ orderId: id })
    .orderBy('createdAt', 'asc')
    .limit(100)
    .get()

  const out = Object.assign({}, order, { id: order._id })
  if (masked) out.phone = maskPhone(out.phone)

  return { ok: true, order: out, logs: logs.data }
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

  if (input.homeId) {
    const homes = await accessibleHomeIds(user._id)
    if (homes.indexOf(input.homeId) === -1) {
      return { ok: false, message: '无权为该房屋下单' }
    }
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
    homeId: input.homeId || '',
    roomType: input.roomType || '',
    elderId: input.elderId || '',
    serviceId: input.serviceId,
    serviceName: input.serviceName,
    icon: input.icon || '',
    provider: input.provider || '',
    staffId: '',
    staffName: '',
    staffUserId: '',
    acceptedAt: 0,
    arrivedAt: 0,
    finishedAt: 0,
    media: [],
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
    // 曾经这里用 DEMO_MODE 做旁路，导致任何人传 actor:'staff' 就能推进别人的订单。
    // 现在只有真实师傅身份才能走 staff 分支。
    const staff = await getStaff(user)
    if (!staff) {
      return { ok: false, message: '无权执行该操作' }
    }
    // 已被接走的单，只有接单的那位师傅能继续操作
    if (order.staffId && order.staffId !== staff._id) {
      return { ok: false, message: '这单不是您接的' }
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

/* ---------- 评价并完成 ---------- */
async function rate(user, id, rating, comment) {
  const order = await loadOrder(id)
  if (!order) return { ok: false, message: '订单不存在' }
  if (!(await canAccessOrder(user, order))) {
    return { ok: false, message: '无权操作该订单' }
  }
  if (order.status !== '待评价') {
    return { ok: false, message: '当前状态「' + order.status + '」不能评价' }
  }

  const score = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)))
  const text = String(comment || '').slice(0, 200)
  const now = Date.now()

  await db.collection('orders').doc(id).update({
    data: {
      status: '已完成',
      rating: score,
      comment: text,
      ratedAt: now,
      updatedAt: now
    }
  })

  await writeLog(id, '待评价', '已完成', user._id, 'user', score + ' 星' + (text ? '：' + text : ''))

  return { ok: true, rating: score }
}

/* ================= 服务人员端 ================= */

function maskPhone(p) {
  const s = String(p || '')
  return s.length === 11 ? s.slice(0, 3) + '****' + s.slice(7) : s
}

async function writeLog(orderId, from, to, operatorId, role, note) {
  await db.collection('order_logs').add({
    data: {
      orderId: orderId,
      fromStatus: from,
      toStatus: to,
      operatorId: operatorId,
      operatorRole: role,
      note: note || '',
      createdAt: Date.now()
    }
  })
}

/* ---------- 工单池 ---------- */
async function pool(user) {
  const staff = await getStaff(user)
  if (!staff) return { ok: false, message: '请先完成师傅认证' }

  const res = await db.collection('orders')
    .where({ status: '待接单' })
    .orderBy('date', 'asc')
    .limit(30)
    .get()

  const list = res.data
    .filter(function (o) { return !o.staffId })
    .map(function (o) {
      return {
        id: o._id,
        orderNo: o.orderNo,
        serviceName: o.serviceName,
        icon: o.icon,
        date: o.date,
        timeSlot: o.timeSlot,
        address: o.address,
        roomType: o.roomType,
        amount: o.amount,
        remark: o.remark,
        contactName: o.contactName,
        // 接单前不给完整号码，避免工单池被批量抄号
        phone: maskPhone(o.phone),
        createdAt: o.createdAt
      }
    })

  return { ok: true, list: list }
}

/* ---------- 我的工单 ---------- */
async function mine(user) {
  const staff = await getStaff(user)
  if (!staff) return { ok: false, message: '请先完成师傅认证' }

  const res = await db.collection('orders')
    .where({ staffId: staff._id })
    .orderBy('acceptedAt', 'desc')
    .limit(30)
    .get()

  return { ok: true, list: res.data.map(function (o) { return Object.assign({}, o, { id: o._id }) }) }
}

/* ---------- 接单（乐观锁） ---------- */
async function accept(user, id) {
  const staff = await getStaff(user)
  if (!staff) return { ok: false, message: '请先完成师傅认证' }
  if (!id) return { ok: false, message: '缺少订单 ID' }

  const now = Date.now()

  // 关键：用 status 做条件更新，两个师傅同时点只有一个能成功
  const res = await db.collection('orders')
    .where({ _id: id, status: '待接单' })
    .update({
      data: {
        status: '已接单',
        staffId: staff._id,
        staffName: staff.name,
        staffPhone: staff.phone,
        staffUserId: user._id,
        acceptedAt: now,
        updatedAt: now
      }
    })

  if (!res.stats || res.stats.updated === 0) {
    return { ok: false, message: '手慢了，这单已被接走' }
  }

  await writeLog(id, '待接单', '已接单', user._id, 'staff', staff.name + ' 接单')
  return { ok: true }
}

/* ---------- 到店打卡 ---------- */
async function arrive(user, id) {
  const staff = await getStaff(user)
  if (!staff) return { ok: false, message: '请先完成师傅认证' }

  const order = await loadOrder(id)
  if (!order) return { ok: false, message: '订单不存在' }
  if (order.staffId !== staff._id) return { ok: false, message: '这不是您的工单' }
  if (order.status !== '已接单') {
    return { ok: false, message: '当前状态「' + order.status + '」不能打卡' }
  }

  const now = Date.now()
  await db.collection('orders').doc(id).update({
    data: { status: '服务中', arrivedAt: now, updatedAt: now }
  })
  await writeLog(id, '已接单', '服务中', user._id, 'staff', '师傅到达现场')

  return { ok: true }
}

/* ---------- 完成服务 ---------- */
async function finish(user, id, media, note) {
  const staff = await getStaff(user)
  if (!staff) return { ok: false, message: '请先完成师傅认证' }

  const order = await loadOrder(id)
  if (!order) return { ok: false, message: '订单不存在' }
  if (order.staffId !== staff._id) return { ok: false, message: '这不是您的工单' }
  if (order.status !== '服务中') {
    return { ok: false, message: '当前状态「' + order.status + '」不能完成' }
  }

  const files = Array.isArray(media) ? media.filter(Boolean).slice(0, 6) : []
  if (files.length === 0) {
    return { ok: false, message: '请至少上传一张现场照片' }
  }

  const now = Date.now()
  const records = (order.records || []).concat([{
    id: 'R' + now,
    time: new Date().toLocaleString('zh-CN', { hour12: false }),
    worker: staff.name,
    content: note || '服务已完成'
  }])

  await db.collection('orders').doc(id).update({
    data: {
      status: '待评价',
      media: files,
      records: records,
      finishedAt: now,
      updatedAt: now
    }
  })
  await writeLog(id, '服务中', '待评价', user._id, 'staff', '提交服务记录与凭证')

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

      case 'pool':
        return await pool(user)
      case 'mine':
        return await mine(user)
      case 'accept':
        return await accept(user, event.id)
      case 'arrive':
        return await arrive(user, event.id)
      case 'finish':
        return await finish(user, event.id, event.media, event.note)
      case 'rate':
        return await rate(user, event.id, event.rating, event.comment)

      default:
        return { ok: false, message: '未知操作：' + event.action }
    }
  } catch (e) {
    return { ok: false, message: '操作失败：' + (e.message || '服务异常') }
  }
}
