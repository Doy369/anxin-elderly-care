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
  removeFamilyMember
}
