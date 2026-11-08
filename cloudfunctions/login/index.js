/**
 * 云函数：登录
 * action: 'login'
 * 返回当前微信用户身份，首次调用自动建档
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 集合自动初始化
 *
 * 云函数首次冷启动时确保 5 个集合存在。已存在会抛错，忽略即可。
 * 这样部署完就能直接用，不必先去控制台手点建集合。
 * 索引仍需在控制台建（SDK 不支持建索引），但不影响功能，只影响查询速度。
 */
const COLLECTIONS = ['users', 'homes', 'home_access', 'elders', 'elder_bindings', 'orders', 'order_logs', 'room_assets', 'staff']
let ensured = false

async function ensureCollections() {
  if (ensured) return
  for (let i = 0; i < COLLECTIONS.length; i++) {
    try {
      await db.createCollection(COLLECTIONS[i])
    } catch (e) {
      // 集合已存在或并发创建，忽略
    }
  }
  ensured = true
}

exports.main = async (event) => {
  await ensureCollections()

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { ok: false, message: '无法获取用户身份，请在小程序内调用' }
  }

  const users = db.collection('users')

  try {
    const existed = await users.where({ openid: openid }).limit(1).get()

    if (existed.data.length > 0) {
      const user = existed.data[0]
      await users.doc(user._id).update({ data: { lastLoginAt: Date.now() } })
      return {
        ok: true,
        user: {
          id: user._id,
          nickname: user.nickname || '',
          avatar: user.avatar || '',
          role: user.role || 'user',
          phone: user.phone || ''
        }
      }
    }

    const doc = {
      openid: openid,
      nickname: '',
      avatar: '',
      phone: '',
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    }
    const added = await users.add({ data: doc })

    return {
      ok: true,
      user: { id: added._id, nickname: '', avatar: '', role: 'user', phone: '' }
    }
  } catch (e) {
    return { ok: false, message: '登录失败：' + (e.message || '数据库异常') }
  }
}
