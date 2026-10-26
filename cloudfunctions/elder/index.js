/**
 * 云函数：家人档案
 *
 * action:
 *   list    列出当前用户可访问的老人档案
 *   create  新建档案（自动建立 owner 绑定）
 *   update  修改档案
 *   remove  删除档案（仅 owner，且无进行中订单）
 *
 * 权限模型：老人档案是数据主体，账号是操作者。
 * 所有读写都必须校验 elder_bindings，前端传什么都不算数。
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const ACTIVE_ORDER = ['待接单', '已接单', '服务中', '待评价']

function nowId() {
  return 'FM' + Date.now() + Math.floor(Math.random() * 1000)
}

async function currentUser(openid) {
  const res = await db.collection('users').where({ openid: openid }).limit(1).get()
  return res.data[0] || null
}

async function getBinding(userId, elderId) {
  const res = await db.collection('elder_bindings')
    .where({ elder_id: elderId, user_id: userId, status: 'active' })
    .limit(1)
    .get()
  return res.data[0] || null
}

/* ---------- list ---------- */
async function list(user) {
  const bindings = await db.collection('elder_bindings')
    .where({ user_id: user._id, status: 'active' })
    .limit(100)
    .get()

  if (bindings.data.length === 0) return { ok: true, list: [] }

  const ids = bindings.data.map(function (b) { return b.elder_id })
  const elders = await db.collection('elders')
    .where({ _id: _.in(ids) })
    .limit(100)
    .get()

  const map = {}
  bindings.data.forEach(function (b) { map[b.elder_id] = b })

  const list = elders.data.map(function (e) {
    const b = map[e._id] || {}
    return Object.assign({}, e, {
      id: e._id,
      relation: b.relation || '其他',
      permission: b.permission || 'member'
    })
  })

  return { ok: true, list: list }
}

/* ---------- create ---------- */
async function create(user, data) {
  if (!data || !data.name || !String(data.name).trim()) {
    return { ok: false, message: '请填写姓名' }
  }
  if (data.phone && !/^1\d{10}$/.test(String(data.phone).trim())) {
    return { ok: false, message: '手机号格式不正确' }
  }

  const elder = {
    name: String(data.name).trim(),
    relation: data.relation || '其他',
    age: data.age ? Number(data.age) : null,
    gender: data.gender || '',
    phone: data.phone || '',
    address: data.address || '',
    note: data.note || '',
    health_tags: data.health_tags || [],
    account_user_id: null,
    createdAt: Date.now()
  }

  const added = await db.collection('elders').add({ data: elder })

  await db.collection('elder_bindings').add({
    data: {
      elder_id: added._id,
      user_id: user._id,
      relation: data.relation || '其他',
      permission: 'owner',
      status: 'active',
      createdAt: Date.now()
    }
  })

  return {
    ok: true,
    member: Object.assign({}, elder, { id: added._id, permission: 'owner' })
  }
}

/* ---------- update ---------- */
async function update(user, id, data) {
  if (!id) return { ok: false, message: '缺少档案 ID' }
  const binding = await getBinding(user._id, id)
  if (!binding) return { ok: false, message: '无权访问该档案' }

  if (data && data.phone && !/^1\d{10}$/.test(String(data.phone).trim())) {
    return { ok: false, message: '手机号格式不正确' }
  }

  const patch = {}
  const fields = ['name', 'relation', 'age', 'gender', 'phone', 'address', 'note', 'health_tags']
  fields.forEach(function (f) {
    if (data && data[f] !== undefined) patch[f] = data[f]
  })
  patch.updatedAt = Date.now()

  await db.collection('elders').doc(id).update({ data: patch })
  return { ok: true, member: Object.assign({ id: id }, patch) }
}

/* ---------- remove ---------- */
async function remove(user, id) {
  if (!id) return { ok: false, message: '缺少档案 ID' }
  const binding = await getBinding(user._id, id)
  if (!binding) return { ok: false, message: '无权操作该档案' }
  if (binding.permission !== 'owner') {
    return { ok: false, message: '只有建档人可以删除档案' }
  }

  const running = await db.collection('orders')
    .where({ elder_id: id, status: _.in(ACTIVE_ORDER) })
    .count()
  if (running.total > 0) {
    return { ok: false, message: '该档案还有进行中的订单，请先完成或取消' }
  }

  await db.collection('elders').doc(id).remove()
  await db.collection('elder_bindings')
    .where({ elder_id: id })
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
        return await update(user, event.id, event.data)
      case 'remove':
        return await remove(user, event.id)
      default:
        return { ok: false, message: '未知操作：' + event.action }
    }
  } catch (e) {
    return { ok: false, message: '操作失败：' + (e.message || '服务异常') }
  }
}
