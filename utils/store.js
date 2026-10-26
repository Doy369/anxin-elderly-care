/**
 * 数据层统一出口
 *
 * 页面只 require 这个文件。走云端还是本地，由 config.js 的 cloudEnv 决定，
 * 页面代码不需要区分。
 *
 * 接口约定：
 *   - 模式、超大字体：同步返回（设备偏好，不上云）
 *   - 订单、家人档案：返回 Promise
 *       .then(data => ...)            读取类，直接给数据
 *       .then(({ok, ...}) => ...)     写入类，带 ok 标志
 *       .catch(err => ...)            网络或权限错误，页面需提示
 */

const cfg = require('./config')
const local = require('./local-store')
const cloud = require('./cloud-api')

const impl = cfg.useCloud ? cloud : local

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
  removeFamilyMember: impl.removeFamilyMember
}
