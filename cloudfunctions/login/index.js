/**
 * 云函数：登录
 * action: 'login'
 * 返回当前微信用户身份，首次调用自动建档
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
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
