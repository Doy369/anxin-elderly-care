/**
 * 数据层统一出口
 *
 * 页面只 require 这个文件。走哪个后端由 config.js 的 backend 决定：
 *   'cloud' 微信云开发 → cloud-api.js
 *   'http'  自建后端   → http-store.js
 *   'local' 本机缓存   → local-store.js
 *
 * 三个实现的方法名、入参、Promise 约定完全一致，所以页面代码不需要区分。
 *
 * 接口约定：
 *   - 模式、超大字体：同步返回（设备偏好，不上云）
 *   - 其余：返回 Promise
 *       .then(data => ...)            读取类，直接给数据
 *       .then(({ok, ...}) => ...)     写入类，带 ok 标志
 *       .catch(err => ...)            网络或权限错误，页面需提示
 */

const cfg = require('./config')
const local = require('./local-store')
const cloud = require('./cloud-api')
const http = require('./http-store')

const IMPLS = { cloud: cloud, http: http, local: local }
const impl = IMPLS[cfg.backend] || local

module.exports = {
  backend: impl.name,

  // 设备偏好（同步）
  getMode: impl.getMode,
  setMode: impl.setMode,
  getBigFont: impl.getBigFont,
  setBigFont: impl.setBigFont,

  // 登录（仅云端有效，本地模式下返回空）
  login: impl.login || function () {
    return Promise.resolve({ user: null, offline: true })
  },

  // 订单
  getOrders: impl.getOrders,
  getOrderById: impl.getOrderById,
  addOrder: impl.addOrder,
  updateOrder: impl.updateOrder,
  removeOrder: impl.removeOrder,

  // 家人档案
  getFamilyMembers: impl.getFamilyMembers,
  addFamilyMember: impl.addFamilyMember,
  updateFamilyMember: impl.updateFamilyMember,
  removeFamilyMember: impl.removeFamilyMember,

  // 评价
  rateOrder: impl.rateOrder,

  // 房屋
  getHomes: impl.getHomes,
  addHome: impl.addHome,
  updateHome: impl.updateHome,
  removeHome: impl.removeHome,

  // 房间资产（照片 + 隐患勾选）
  getRoomAssets: impl.getRoomAssets,
  saveRoomPhoto: impl.saveRoomPhoto,
  removeRoomPhoto: impl.removeRoomPhoto,
  setRoomChecks: impl.setRoomChecks,
  uploadImage: impl.uploadImage,

  // 服务人员端
  getStaffMe: impl.getStaffMe,
  activateStaff: impl.activateStaff,
  getOrderPool: impl.getOrderPool,
  getMyWorkOrders: impl.getMyWorkOrders,
  acceptOrder: impl.acceptOrder,
  arriveOrder: impl.arriveOrder,
  finishOrder: impl.finishOrder,
  uploadWorkPhoto: impl.uploadWorkPhoto
}
