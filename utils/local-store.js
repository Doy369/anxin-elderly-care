/**
 * 本地存储实现（兜底）
 *
 * 用途：云开发未开通、或云端调用失败时，数据仍能落在本机，应用不会白屏。
 * 接口与 cloud-api 完全一致，全部返回 Promise，页面无需区分。
 */

const KEYS = {
  MODE: 'mode',
  BIGFONT: 'bigFont',
  ORDERS: 'orders',
  FAMILY: 'familyMembers'
}

function read(key, fallback) {
  try {
    const raw = wx.getStorageSync(key)
    if (raw === '' || raw === null || raw === undefined) return fallback
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch (e) {
    return fallback
  }
}

function write(key, value) {
  try {
    wx.setStorageSync(key, JSON.stringify(value))
    return true
  } catch (e) {
    return false
  }
}

/* ---------- 使用模式（设备偏好，始终本地） ---------- */
function getMode() {
  return read(KEYS.MODE, 'elder')
}

function setMode(mode) {
  return write(KEYS.MODE, mode)
}

function getBigFont() {
  try {
    return wx.getStorageSync(KEYS.BIGFONT) === true
  } catch (e) {
    return false
  }
}

function setBigFont(on) {
  try {
    wx.setStorageSync(KEYS.BIGFONT, !!on)
    return true
  } catch (e) {
    return false
  }
}

/* ---------- 订单 ---------- */
function getOrders() {
  return Promise.resolve(read(KEYS.ORDERS, []))
}

function getOrderById(id) {
  const hit = read(KEYS.ORDERS, []).find(function (o) {
    return o.id === id
  })
  return Promise.resolve(hit || null)
}

function addOrder(order) {
  const list = read(KEYS.ORDERS, [])
  list.unshift(order)
  if (!write(KEYS.ORDERS, list)) {
    return Promise.resolve({ ok: false, message: '本地存储写入失败，可能是空间不足' })
  }
  return Promise.resolve({ ok: true, order: order })
}

function updateOrder(id, patch) {
  const list = read(KEYS.ORDERS, [])
  let hit = null
  list.forEach(function (item) {
    if (item.id === id) {
      item.status = patch.status || item.status
      item.records = patch.records || item.records
      item.cancelReason = patch.cancelReason !== undefined ? patch.cancelReason : item.cancelReason
      hit = item
    }
  })
  write(KEYS.ORDERS, list)
  return Promise.resolve({ ok: !!hit, order: hit, message: hit ? '' : '订单不存在' })
}

function removeOrder(id) {
  const list = read(KEYS.ORDERS, []).filter(function (o) {
    return o.id !== id
  })
  write(KEYS.ORDERS, list)
  return Promise.resolve({ ok: true })
}

/* ---------- 家人档案 ---------- */
function getFamilyMembers() {
  return Promise.resolve(read(KEYS.FAMILY, []))
}

function addFamilyMember(member) {
  const list = read(KEYS.FAMILY, [])
  const record = Object.assign({}, member, {
    id: 'FM' + Date.now(),
    createdAt: Date.now()
  })
  list.push(record)
  if (!write(KEYS.FAMILY, list)) {
    return Promise.resolve({ ok: false, message: '本地存储写入失败' })
  }
  return Promise.resolve({ ok: true, member: record })
}

function updateFamilyMember(id, patch) {
  const list = read(KEYS.FAMILY, [])
  let hit = null
  list.forEach(function (item) {
    if (item.id === id) {
      Object.assign(item, patch)
      hit = item
    }
  })
  write(KEYS.FAMILY, list)
  return Promise.resolve({ ok: !!hit, member: hit, message: hit ? '' : '档案不存在' })
}

function removeFamilyMember(id) {
  const list = read(KEYS.FAMILY, []).filter(function (m) {
    return m.id !== id
  })
  write(KEYS.FAMILY, list)
  return Promise.resolve({ ok: true })
}

/* ---------- 评价 ---------- */
function rateOrder(id, rating, comment) {
  const list = read(KEYS.ORDERS, [])
  let hit = null
  list.forEach(function (item) {
    if (item.id === id) {
      item.status = '已完成'
      item.rating = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)))
      item.comment = String(comment || '')
      item.ratedAt = Date.now()
      hit = item
    }
  })
  write(KEYS.ORDERS, list)
  return Promise.resolve({ ok: !!hit, order: hit, message: hit ? '' : '订单不存在' })
}

/* ---------- 房屋（本地退化实现） ---------- */
function getHomes() {
  let list = read('homes', null)
  if (!list || list.length === 0) {
    list = [{
      id: 'home_local',
      name: '我的家',
      address: '',
      area: 0,
      floor: 0,
      elevator: false,
      remark: '',
      role: 'owner'
    }]
    write('homes', list)
  }
  return Promise.resolve(list)
}

function addHome(data) {
  const list = read('homes', [])
  const home = Object.assign({
    id: 'home_' + Date.now(),
    name: '我的家',
    address: '',
    area: 0,
    floor: 0,
    elevator: false,
    remark: '',
    role: 'owner'
  }, data)
  list.push(home)
  write('homes', list)
  return Promise.resolve({ ok: true, home: home })
}

function updateHome(homeId, data) {
  const list = read('homes', [])
  let hit = null
  list.forEach(function (h) {
    if (h.id === homeId) {
      Object.assign(h, data)
      hit = h
    }
  })
  write('homes', list)
  return Promise.resolve({ ok: !!hit, home: hit, message: hit ? '' : '房屋不存在' })
}

function removeHome(homeId) {
  const list = read('homes', []).filter(function (h) {
    return h.id !== homeId
  })
  write('homes', list)
  return Promise.resolve({ ok: true })
}

/* ---------- 房间资产 ---------- */
function getRoomAssets(homeId) {
  const map = read('roomAssets', {})
  return Promise.resolve(map[homeId] || {})
}

function saveRoomPhoto(homeId, roomType, fileID) {
  const map = read('roomAssets', {})
  map[homeId] = map[homeId] || {}
  map[homeId][roomType] = Object.assign({ checks: [] }, map[homeId][roomType], {
    fileID: fileID,
    photoUpdatedAt: Date.now()
  })
  write('roomAssets', map)
  return Promise.resolve({ ok: true })
}

function removeRoomPhoto(homeId, roomType) {
  const map = read('roomAssets', {})
  if (map[homeId] && map[homeId][roomType]) {
    map[homeId][roomType].fileID = ''
    map[homeId][roomType].photoUpdatedAt = Date.now()
    write('roomAssets', map)
  }
  return Promise.resolve({ ok: true })
}

function setRoomChecks(homeId, roomType, checks) {
  const map = read('roomAssets', {})
  map[homeId] = map[homeId] || {}
  map[homeId][roomType] = Object.assign({ fileID: '' }, map[homeId][roomType], {
    checks: checks || [],
    checksUpdatedAt: Date.now()
  })
  write('roomAssets', map)
  return Promise.resolve({ ok: true })
}

function uploadImage() {
  return Promise.reject(new Error('未连接云开发，照片无法保存'))
}

/* ---------- 服务人员（本地不可用，给明确提示） ---------- */
function getStaffMe() {
  return Promise.resolve({ ok: true, staff: null, role: 'user' })
}

function activateStaff() {
  return Promise.reject(new Error('未连接云开发，师傅认证需要联网'))
}

function getOrderPool() {
  return Promise.resolve([])
}

function getMyWorkOrders() {
  return Promise.resolve([])
}

function acceptOrder() {
  return Promise.reject(new Error('未连接云开发，无法接单'))
}

function arriveOrder() {
  return Promise.reject(new Error('未连接云开发，无法打卡'))
}

function finishOrder() {
  return Promise.reject(new Error('未连接云开发，无法完成工单'))
}

function uploadWorkPhoto() {
  return Promise.reject(new Error('未连接云开发，照片无法保存'))
}

module.exports = {
  name: 'local',
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
