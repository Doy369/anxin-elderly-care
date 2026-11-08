/**
 * 云函数：房间资产（实拍图 + 隐患勾选）
 *
 * 归属是「房屋」，不是账号——所以子女换自己微信登录，也能看到同一套房子的照片。
 * 一条记录 = 一间房，照片和勾选放在一起，读一页只查一次。
 *
 * action:
 *   list        某套房的全部房间资产 { assets: { roomType: {...} } }
 *   savePhoto   保存/替换某房间照片
 *   removePhoto 删除某房间照片
 *   setChecks   保存某房间的隐患勾选
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const ROOM_IDS = ['living', 'bedroom', 'kitchen', 'bathroom', 'entry', 'balcony']

async function currentUser(openid) {
  const res = await db.collection('users').where({ openid: openid }).limit(1).get()
  return res.data[0] || null
}

async function hasHomeAccess(userId, homeId) {
  const res = await db.collection('home_access')
    .where({ homeId: homeId, userId: userId, status: 'active' })
    .limit(1)
    .get()
  return res.data.length > 0
}

async function getStaff(userId) {
  const res = await db.collection('staff')
    .where({ userId: userId, status: 'active' })
    .limit(1)
    .get()
  return res.data[0] || null
}

/**
 * 师傅能不能看这套房的照片：只读，且必须手上有这套房的单。
 * 接单前（待接单）不给看，避免工单池里的人把别人家照片都翻一遍。
 */
async function isAssignedStaff(userId, homeId) {
  const staff = await getStaff(userId)
  if (!staff) return false

  const res = await db.collection('orders')
    .where({
      homeId: homeId,
      staffId: staff._id,
      status: db.command.in(['已接单', '服务中', '待评价', '已完成'])
    })
    .limit(1)
    .get()

  return res.data.length > 0
}

async function findAsset(homeId, roomType) {
  const res = await db.collection('room_assets')
    .where({ homeId: homeId, roomType: roomType })
    .limit(1)
    .get()
  return res.data[0] || null
}

/* ---------- list ---------- */
async function list(user, homeId) {
  if (!homeId) return { ok: false, message: '缺少房屋 ID' }

  const isMember = await hasHomeAccess(user._id, homeId)
  const isStaff = isMember ? false : await isAssignedStaff(user._id, homeId)

  if (!isMember && !isStaff) {
    return { ok: false, message: '无权查看该房屋' }
  }

  const res = await db.collection('room_assets')
    .where({ homeId: homeId })
    .limit(20)
    .get()

  const assets = {}
  res.data.forEach(function (row) {
    assets[row.roomType] = {
      fileID: row.photoFileID || '',
      checks: row.checks || [],
      photoUpdatedAt: row.photoUpdatedAt || 0,
      checksUpdatedAt: row.checksUpdatedAt || 0
    }
  })

  return { ok: true, assets: assets, readOnly: !isMember }
}

/* ---------- 公共：取或建一条房间记录 ---------- */
async function ensureAsset(homeId, roomType) {
  const hit = await findAsset(homeId, roomType)
  if (hit) return hit

  const doc = {
    homeId: homeId,
    roomType: roomType,
    photoFileID: '',
    checks: [],
    photoUpdatedAt: 0,
    checksUpdatedAt: 0,
    createdAt: Date.now()
  }
  const added = await db.collection('room_assets').add({ data: doc })
  return Object.assign({ _id: added._id }, doc)
}

/* ---------- savePhoto ---------- */
async function savePhoto(user, homeId, roomType, fileID) {
  if (ROOM_IDS.indexOf(roomType) === -1) {
    return { ok: false, message: '未知房间：' + roomType }
  }
  if (!fileID) return { ok: false, message: '缺少图片标识' }
  if (!(await hasHomeAccess(user._id, homeId))) {
    return { ok: false, message: '无权修改该房屋' }
  }

  const asset = await ensureAsset(homeId, roomType)
  const oldFileID = asset.photoFileID
  const now = Date.now()

  await db.collection('room_assets').doc(asset._id).update({
    data: { photoFileID: fileID, photoUpdatedAt: now }
  })

  // 换图时删掉旧文件，避免云存储越攒越多
  if (oldFileID && oldFileID !== fileID) {
    try {
      await cloud.deleteFile({ fileList: [oldFileID] })
    } catch (e) {
      // 删不掉不影响主流程
    }
  }

  return { ok: true, roomType: roomType, fileID: fileID, photoUpdatedAt: now }
}

/* ---------- removePhoto ---------- */
async function removePhoto(user, homeId, roomType) {
  if (!(await hasHomeAccess(user._id, homeId))) {
    return { ok: false, message: '无权修改该房屋' }
  }

  const asset = await findAsset(homeId, roomType)
  if (!asset) return { ok: true }

  const fileID = asset.photoFileID
  await db.collection('room_assets').doc(asset._id).update({
    data: { photoFileID: '', photoUpdatedAt: Date.now() }
  })

  if (fileID) {
    try {
      await cloud.deleteFile({ fileList: [fileID] })
    } catch (e) {
      // 忽略
    }
  }

  return { ok: true }
}

/* ---------- setChecks ---------- */
async function setChecks(user, homeId, roomType, checks) {
  if (ROOM_IDS.indexOf(roomType) === -1) {
    return { ok: false, message: '未知房间：' + roomType }
  }
  if (!(await hasHomeAccess(user._id, homeId))) {
    return { ok: false, message: '无权修改该房屋' }
  }

  const list = Array.isArray(checks)
    ? checks.filter(function (n) { return typeof n === 'number' && n >= 0 && n < 20 })
    : []

  const asset = await ensureAsset(homeId, roomType)
  const now = Date.now()

  await db.collection('room_assets').doc(asset._id).update({
    data: { checks: list, checksUpdatedAt: now }
  })

  return { ok: true, roomType: roomType, checks: list }
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return { ok: false, message: '无法获取用户身份' }

  const user = await currentUser(openid)
  if (!user) return { ok: false, message: '用户不存在，请重新进入小程序' }

  const homeId = event.homeId

  try {
    switch (event.action) {
      case 'list':
        return await list(user, homeId)
      case 'savePhoto':
        return await savePhoto(user, homeId, event.roomType, event.fileID)
      case 'removePhoto':
        return await removePhoto(user, homeId, event.roomType)
      case 'setChecks':
        return await setChecks(user, homeId, event.roomType, event.checks)
      default:
        return { ok: false, message: '未知操作：' + event.action }
    }
  } catch (e) {
    return { ok: false, message: '操作失败：' + (e.message || '服务异常') }
  }
}
