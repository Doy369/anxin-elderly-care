/**
 * 云端数据实现（微信云开发）
 *
 * 约定：所有方法返回 Promise，成功 resolve 数据，失败 reject(Error)。
 * 失败不静默降级——页面需要明确告诉用户「网络异常」，
 * 否则用户会以为自己没有订单。
 */

const cfg = require('./config')

function call(name, data) {
  return new Promise(function (resolve, reject) {
    if (!wx.cloud) {
      reject(new Error('当前基础库不支持云开发，请升级微信版本'))
      return
    }
    wx.cloud.callFunction({
      name: name,
      data: data || {},
      config: { env: cfg.cloudEnv },
      success: function (res) {
        const r = (res && res.result) || {}
        if (r.ok === false) {
          reject(new Error(r.message || '操作失败'))
          return
        }
        resolve(r)
      },
      fail: function (err) {
        const msg = (err && err.errMsg) || '网络异常'
        reject(new Error(msg.indexOf('timeout') > -1 ? '请求超时，请检查网络' : msg))
      }
    })
  })
}

/* ---------- 使用模式：设备偏好，不走云端 ---------- */
function getMode() {
  try {
    const raw = wx.getStorageSync('mode')
    return raw || 'elder'
  } catch (e) {
    return 'elder'
  }
}

function setMode(mode) {
  try {
    wx.setStorageSync('mode', mode)
    return true
  } catch (e) {
    return false
  }
}

function getBigFont() {
  try {
    return wx.getStorageSync('bigFont') === true
  } catch (e) {
    return false
  }
}

function setBigFont(on) {
  try {
    wx.setStorageSync('bigFont', !!on)
    return true
  } catch (e) {
    return false
  }
}

/* ---------- 登录 ---------- */
function login() {
  return call('login', { action: 'login' })
}

/* ---------- 订单 ---------- */
function getOrders() {
  return call('order', { action: 'list' }).then(function (r) {
    return r.list || []
  })
}

function getOrderById(id) {
  return call('order', { action: 'detail', id: id }).then(function (r) {
    return r.order || null
  })
}

function addOrder(order) {
  return call('order', { action: 'create', order: order })
}

function updateOrder(id, patch) {
  // 云端只接受状态机允许的动作，不接受裸状态覆盖
  if (patch.status) {
    return call('order', { action: 'transition', id: id, to: patch.status, note: patch.cancelReason || '' })
  }
  if (patch.records) {
    const last = patch.records[patch.records.length - 1]
    return call('order', {
      action: 'addRecord',
      id: id,
      content: last ? last.content : '',
      worker: last ? last.worker : ''
    })
  }
  return Promise.resolve({ ok: true })
}

function removeOrder(id) {
  return call('order', { action: 'remove', id: id })
}

/* ---------- 家人档案 ---------- */
function getFamilyMembers() {
  return call('elder', { action: 'list' }).then(function (r) {
    return r.list || []
  })
}

function addFamilyMember(member) {
  return call('elder', { action: 'create', data: member })
}

function updateFamilyMember(id, patch) {
  return call('elder', { action: 'update', id: id, data: patch })
}

function removeFamilyMember(id) {
  return call('elder', { action: 'remove', id: id })
}

module.exports = {
  name: 'cloud',
  login,
  getMode,
  setMode,
  getBigFont,
  setBigFont,
  getOrders,
  getOrderById,
  addOrder,
  updateOrder,
  removeOrder,
  getFamilyMembers,
  addFamilyMember,
  updateFamilyMember,
  removeFamilyMember
}
