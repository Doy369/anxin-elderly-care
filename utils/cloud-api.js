/**
 * 云端数据实现（微信云开发）
 *
 * 约定：所有方法返回 Promise，成功 resolve 数据，失败 reject(Error)。
 * 失败不静默降级——页面需要明确告诉用户「网络异常」，
 * 否则用户会以为自己没有订单。
 */

const cfg = require('./config')

/**
 * 把云端原始报错翻译成用户能看懂的话。
 * 原始信息仍打到控制台，方便排查。
 */
function friendly(msg) {
  const raw = String(msg || '')
  if (/-502005|collection not exists|Db or Table not exist/i.test(raw)) {
    return '数据初始化中，请退出小程序重新进入'
  }
  if (/-501000|cloud function not found|FunctionName parameter could not be found/i.test(raw)) {
    return '服务未部署，请稍后重试'
  }
  if (/-502003|permission denied|PERMISSION_DENIED/i.test(raw)) {
    return '没有权限访问，请重新登录'
  }
  if (/timeout/i.test(raw)) {
    return '网络超时，请重试'
  }
  if (/network|request:fail/i.test(raw)) {
    return '网络异常，请检查网络后重试'
  }
  return raw
}

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
          console.error('[cloud] ' + name + ' 业务失败:', r.message)
          reject(new Error(friendly(r.message || '操作失败')))
          return
        }
        resolve(r)
      },
      fail: function (err) {
        const msg = (err && err.errMsg) || '网络异常'
        console.error('[cloud] ' + name + ' 调用失败:', msg)
        reject(new Error(friendly(msg)))
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
/**
 * 所有云函数都依赖 users 里的用户记录，而 app.onLaunch 的登录是异步的。
 * 页面 onShow 可能先跑，导致后端查不到 user 而报「用户不存在」。
 * 这里用一个共享 Promise 做门禁：任何调用都先等首次登录完成。
 */
let ready = null

function ensureReady() {
  if (!ready) {
    ready = call('login', { action: 'login' }).catch(function (e) {
      // 失败后清空，允许下次重试
      ready = null
      throw e
    })
  }
  return ready
}

function login() {
  return ensureReady()
}

// 业务调用统一先过登录门禁
function send(name, data) {
  return ensureReady().then(function () {
    return call(name, data)
  })
}

/* ---------- 订单 ---------- */
function getOrders() {
  return send('order', { action: 'list' }).then(function (r) {
    return r.list || []
  })
}

function getOrderById(id) {
  return send('order', { action: 'detail', id: id }).then(function (r) {
    return r.order || null
  })
}

function addOrder(order) {
  return send('order', { action: 'create', order: order })
}

function updateOrder(id, patch) {
  // 云端只接受状态机允许的动作，不接受裸状态覆盖
  if (patch.status) {
    return send('order', { action: 'transition', id: id, to: patch.status, note: patch.cancelReason || '' })
  }
  if (patch.records) {
    const last = patch.records[patch.records.length - 1]
    return send('order', {
      action: 'addRecord',
      id: id,
      content: last ? last.content : '',
      worker: last ? last.worker : ''
    })
  }
  return Promise.resolve({ ok: true })
}

function removeOrder(id) {
  return send('order', { action: 'remove', id: id })
}

/* ---------- 家人档案 ---------- */
function getFamilyMembers() {
  return send('elder', { action: 'list' }).then(function (r) {
    return r.list || []
  })
}

function addFamilyMember(member) {
  return send('elder', { action: 'create', data: member })
}

function updateFamilyMember(id, patch) {
  return send('elder', { action: 'update', id: id, data: patch })
}

function removeFamilyMember(id) {
  return send('elder', { action: 'remove', id: id })
}

/* ---------- 评价 ---------- */
function rateOrder(id, rating, comment) {
  return send('order', { action: 'rate', id: id, rating: rating, comment: comment })
}

/* ---------- 房屋 ---------- */
function getHomes() {
  return send('home', { action: 'list' }).then(function (r) {
    return r.list || []
  })
}

function addHome(data) {
  return send('home', { action: 'create', data: data })
}

function updateHome(homeId, data) {
  return send('home', { action: 'update', homeId: homeId, data: data })
}

function removeHome(homeId) {
  return send('home', { action: 'remove', homeId: homeId })
}

/* ---------- 房间资产（照片 + 勾选） ---------- */
function getRoomAssets(homeId) {
  return send('room', { action: 'list', homeId: homeId }).then(function (r) {
    return r.assets || {}
  })
}

function saveRoomPhoto(homeId, roomType, fileID) {
  return send('room', { action: 'savePhoto', homeId: homeId, roomType: roomType, fileID: fileID })
}

function removeRoomPhoto(homeId, roomType) {
  return send('room', { action: 'removePhoto', homeId: homeId, roomType: roomType })
}

function setRoomChecks(homeId, roomType, checks) {
  return send('room', { action: 'setChecks', homeId: homeId, roomType: roomType, checks: checks })
}

/**
 * 把本地临时文件传到云存储，返回 fileID。
 * 注意：只有云端模式可用，本地模式没有云存储。
 */
function uploadImage(localPath, homeId, roomType) {
  return new Promise(function (resolve, reject) {
    if (!wx.cloud || !wx.cloud.uploadFile) {
      reject(new Error('云开发未启用，照片无法保存'))
      return
    }
    const ext = (localPath.match(/\.(\w+)$/) || [])[1] || 'jpg'
    const cloudPath = 'homes/' + (homeId || 'unknown') + '/' + roomType + '_' + Date.now() + '.' + ext

    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: localPath,
      success: function (res) {
        if (!res.fileID) {
          reject(new Error('上传失败，请重试'))
          return
        }
        resolve(res.fileID)
      },
      fail: function (err) {
        const msg = (err && err.errMsg) || '上传失败'
        reject(new Error(msg.indexOf('timeout') > -1 ? '上传超时，请检查网络' : msg))
      }
    })
  })
}

/* ---------- 服务人员 ---------- */
function getStaffMe() {
  return send('staff', { action: 'me' })
}

function activateStaff(data) {
  return send('staff', { action: 'activate', data: data })
}

function getOrderPool() {
  return send('order', { action: 'pool' }).then(function (r) {
    return r.list || []
  })
}

function getMyWorkOrders() {
  return send('order', { action: 'mine' }).then(function (r) {
    return r.list || []
  })
}

function acceptOrder(id) {
  return send('order', { action: 'accept', id: id })
}

function arriveOrder(id) {
  return send('order', { action: 'arrive', id: id })
}

function finishOrder(id, media, note) {
  return send('order', { action: 'finish', id: id, media: media, note: note })
}

/**
 * 上传师傅的现场照片。云存储按订单号分目录，方便按单追溯。
 */
function uploadWorkPhoto(localPath, orderId) {
  return new Promise(function (resolve, reject) {
    if (!wx.cloud || !wx.cloud.uploadFile) {
      reject(new Error('云开发未启用，照片无法保存'))
      return
    }
    const ext = (localPath.match(/\.(\w+)$/) || [])[1] || 'jpg'
    const cloudPath = 'orders/' + (orderId || 'unknown') + '/work_' + Date.now() + '.' + ext

    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: localPath,
      success: function (res) {
        if (!res.fileID) {
          reject(new Error('上传失败，请重试'))
          return
        }
        resolve(res.fileID)
      },
      fail: function (err) {
        const msg = (err && err.errMsg) || '上传失败'
        reject(new Error(msg.indexOf('timeout') > -1 ? '上传超时，请检查网络' : msg))
      }
    })
  })
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
  removeFamilyMember,
  rateOrder,

  getHomes,
  addHome,
  updateHome,
  removeHome,

  getRoomAssets,
  saveRoomPhoto,
  removeRoomPhoto,
  setRoomChecks,
  uploadImage,

  getStaffMe,
  activateStaff,
  getOrderPool,
  getMyWorkOrders,
  acceptOrder,
  arriveOrder,
  finishOrder,
  uploadWorkPhoto
}
