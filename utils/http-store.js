/**
 * 自建后端数据实现（HTTP + 自己的数据库）
 *
 * 与 cloud-api.js 一一对应：同样的方法名、同样的入参、同样的 Promise 约定
 * （成功 resolve 数据，业务失败 reject Error）。
 * 页面只认 utils/store.js，切换后端不需要改任何页面。
 *
 * 服务端契约：POST {apiBase}/{模块}，body 里的 action 与云函数同名同参，
 * 这样云函数的 switch 分支可以几乎原样搬到服务端，迁移风险最小。
 *
 *   模块：auth / order / home / room / elder / staff
 *   返回：{ ok: true, ... }  或  { ok: false, message: '...' }
 *   鉴权：Authorization: Bearer <token>
 *
 * 未配置 apiBase 时所有网络方法会明确报错，不会静默返回空数据——
 * 否则页面会显示「没有订单」，让人误以为业务数据丢了。
 */

const cfg = require('./config')
const local = require('./local-store')

/* ---------- 登录态 ---------- */
function getToken() {
  try {
    return wx.getStorageSync(cfg.tokenKey) || ''
  } catch (e) {
    return ''
  }
}

function setToken(token) {
  try {
    wx.setStorageSync(cfg.tokenKey, token || '')
  } catch (e) {
    // 存不进去就让用户重新登录
  }
}

function clearToken() {
  try {
    wx.removeStorageSync(cfg.tokenKey)
  } catch (e) {
    // 忽略
  }
}

function friendly(msg) {
  const raw = String(msg || '')
  if (/abort|timeout/i.test(raw)) return '网络超时，请重试'
  if (/fail|network/i.test(raw)) return '网络异常，请检查网络后重试'
  return raw || '请求失败'
}

/* ---------- 基础请求 ---------- */
let ready = null

function base() {
  return String(cfg.apiBase || '').replace(/\/+$/, '')
}

function post(module, data) {
  return new Promise(function (resolve, reject) {
    const root = base()
    if (!root) {
      reject(new Error('未配置后端地址，请在 utils/config.js 里填写 API_BASE'))
      return
    }

    const token = getToken()
    const header = { 'content-type': 'application/json' }
    if (token) header.Authorization = 'Bearer ' + token

    wx.request({
      url: root + '/' + module,
      method: 'POST',
      timeout: cfg.apiTimeout,
      header: header,
      data: data || {},
      success: function (res) {
        const body = res.data || {}

        if (res.statusCode === 401) {
          clearToken()
          ready = null
          reject(new Error('登录已过期，请重新进入小程序'))
          return
        }
        if (res.statusCode === 403) {
          reject(new Error(body.message || '没有权限执行该操作'))
          return
        }
        if (res.statusCode >= 500) {
          console.error('[http] ' + module + ' 服务端错误:', res.statusCode, body)
          reject(new Error('服务异常，请稍后重试'))
          return
        }
        if (body.ok === false) {
          console.error('[http] ' + module + ' 业务失败:', body.message)
          reject(new Error(friendly(body.message || '操作失败')))
          return
        }
        resolve(body)
      },
      fail: function (err) {
        const msg = (err && err.errMsg) || '网络异常'
        console.error('[http] ' + module + ' 调用失败:', msg)
        reject(new Error(friendly(msg)))
      }
    })
  })
}

/* ---------- 登录 ---------- */
function doLogin() {
  return new Promise(function (resolve, reject) {
    wx.login({
      success: function (res) {
        if (!res.code) {
          reject(new Error('微信登录失败，请重试'))
          return
        }
        post('auth', { action: 'login', code: res.code }).then(function (body) {
          if (body.token) setToken(body.token)
          resolve({ user: body.user || null })
        }).catch(reject)
      },
      fail: function () {
        reject(new Error('微信登录失败，请重试'))
      }
    })
  })
}

function ensureReady() {
  if (!ready) {
    ready = doLogin().catch(function (e) {
      ready = null
      throw e
    })
  }
  return ready
}

function login() {
  return ensureReady()
}

function send(module, data) {
  return ensureReady().then(function () {
    return post(module, data)
  })
}

/* ---------- 设备偏好（不上云，直接读写本机） ---------- */
const getMode = local.getMode
const setMode = local.setMode
const getBigFont = local.getBigFont
const setBigFont = local.setBigFont

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
  // 与云端一致：只接受状态机允许的动作，不做裸状态覆盖
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

function rateOrder(id, rating, comment) {
  return send('order', { action: 'rate', id: id, rating: rating, comment: comment })
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

/* ---------- 房间资产 ---------- */
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

/* ---------- 文件上传 ---------- */
/**
 * 上传到自建后端的 /upload 接口，服务端落对象存储后返回 fileID（或可访问 URL）。
 * 注意：不能把 accessKey 放在小程序里，签名必须由服务端下发。
 */
function uploadFile(localPath, folder, name) {
  return new Promise(function (resolve, reject) {
    const root = base()
    if (!root) {
      reject(new Error('未配置后端地址，照片无法保存'))
      return
    }

    const token = getToken()
    const header = {}
    if (token) header.Authorization = 'Bearer ' + token

    wx.uploadFile({
      url: root + '/upload',
      filePath: localPath,
      name: 'file',
      timeout: cfg.apiTimeout,
      header: header,
      formData: { folder: folder, name: name },
      success: function (res) {
        let body = res.data
        try {
          body = JSON.parse(res.data)
        } catch (e) {
          // 服务端返回的不是 JSON
        }
        if (res.statusCode === 401) {
          clearToken()
          ready = null
          reject(new Error('登录已过期，请重新进入小程序'))
          return
        }
        if (!body || body.ok === false || !body.fileID) {
          reject(new Error((body && body.message) || '上传失败，请重试'))
          return
        }
        resolve(body.fileID)
      },
      fail: function (err) {
        const msg = (err && err.errMsg) || '上传失败'
        reject(new Error(msg.indexOf('timeout') > -1 ? '上传超时，请检查网络' : msg))
      }
    })
  })
}

function uploadImage(localPath, homeId, roomType) {
  return uploadFile(localPath, 'homes/' + (homeId || 'unknown'), roomType)
}

function uploadWorkPhoto(localPath, orderId) {
  return uploadFile(localPath, 'orders/' + (orderId || 'unknown'), 'work')
}

module.exports = {
  name: 'http',

  getMode,
  setMode,
  getBigFont,
  setBigFont,

  login,

  getOrders,
  getOrderById,
  addOrder,
  updateOrder,
  removeOrder,
  rateOrder,

  getFamilyMembers,
  addFamilyMember,
  updateFamilyMember,
  removeFamilyMember,

  getHomes,
  addHome,
  updateHome,
  removeHome,

  getRoomAssets,
  saveRoomPhoto,
  removeRoomPhoto,
  setRoomChecks,

  getStaffMe,
  activateStaff,
  getOrderPool,
  getMyWorkOrders,
  acceptOrder,
  arriveOrder,
  finishOrder,

  uploadImage,
  uploadWorkPhoto
}
