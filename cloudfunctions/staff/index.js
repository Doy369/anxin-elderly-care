/**
 * 云函数：服务人员身份
 *
 * 一期没有后台审核，用激活码开通。内测阶段师傅就几个，够用；
 * 二期接入机构后换成机构邀请码或后台审核。
 *
 * action:
 *   me        查询自己的师傅身份
 *   activate  用激活码开通/更新师傅资料
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 激活码。上线前改成一个随机串，只发给通过审核的师傅。
 */
const STAFF_CODE = 'AXIN2026'

async function currentUser(openid) {
  const res = await db.collection('users').where({ openid: openid }).limit(1).get()
  return res.data[0] || null
}

async function findStaff(userId) {
  const res = await db.collection('staff')
    .where({ userId: userId, status: 'active' })
    .limit(1)
    .get()
  return res.data[0] || null
}

/* ---------- me ---------- */
async function me(user) {
  const staff = await findStaff(user._id)
  if (!staff) return { ok: true, staff: null, role: user.role || 'user' }

  return {
    ok: true,
    role: 'staff',
    staff: {
      id: staff._id,
      name: staff.name,
      phone: staff.phone,
      joinedAt: staff.createdAt
    }
  }
}

/* ---------- activate ---------- */
async function activate(user, data) {
  const code = String((data && data.code) || '').trim().toUpperCase()
  const name = String((data && data.name) || '').trim()
  const phone = String((data && data.phone) || '').trim()

  if (code !== STAFF_CODE) {
    return { ok: false, message: '激活码不对，请联系管理员' }
  }
  if (!name) {
    return { ok: false, message: '请填写真实姓名' }
  }
  if (!/^1\d{10}$/.test(phone)) {
    return { ok: false, message: '手机号格式不正确' }
  }

  const existed = await findStaff(user._id)

  if (existed) {
    await db.collection('staff').doc(existed._id).update({
      data: { name: name, phone: phone, updatedAt: Date.now() }
    })
    await db.collection('users').doc(user._id).update({ data: { role: 'staff' } })
    return { ok: true, staff: { id: existed._id, name: name, phone: phone } }
  }

  const added = await db.collection('staff').add({
    data: {
      userId: user._id,
      name: name,
      phone: phone,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  })

  await db.collection('users').doc(user._id).update({ data: { role: 'staff' } })

  return { ok: true, staff: { id: added._id, name: name, phone: phone } }
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return { ok: false, message: '无法获取用户身份' }

  const user = await currentUser(openid)
  if (!user) return { ok: false, message: '用户不存在，请重新进入小程序' }

  try {
    switch (event.action) {
      case 'me':
        return await me(user)
      case 'activate':
        return await activate(user, event.data)
      default:
        return { ok: false, message: '未知操作：' + event.action }
    }
  } catch (e) {
    return { ok: false, message: '操作失败：' + (e.message || '服务异常') }
  }
}
