/**
 * 全局配置
 *
 * 后端三选一，改 BACKEND 一个常量即可，页面代码不用动：
 *
 *   'cloud'  微信云开发（当前使用）
 *   'http'   自建后端。需要把 API_BASE 填成你的 HTTPS 域名，
 *            并在小程序后台「开发管理 → 服务器域名 → request 合法域名」里加上它
 *   'local'  本机缓存，只用于开发调试。换手机就没了，也不能多人共享
 */

const BACKEND = 'cloud'

// 云开发环境 ID（云开发控制台 → 设置 → 环境ID）
const CLOUD_ENV = 'cloud1-d5gl1cb3tac0ac224'

// 自建后端地址，必须 HTTPS。BACKEND 为 'http' 时才用到
const API_BASE = ''

module.exports = {
  backend: BACKEND,

  cloudEnv: CLOUD_ENV,
  // 兼容旧引用：是否走云开发
  useCloud: BACKEND === 'cloud',

  apiBase: API_BASE,
  // 自建后端的登录态存储键
  tokenKey: 'api_token',

  // 云函数超时时间（毫秒）
  cloudTimeout: 10000,
  // wx.request / wx.uploadFile 超时时间（毫秒）
  apiTimeout: 15000,

  /**
   * 演示模式：机构端上线前，允许从订单详情手动推进状态，用来跑通全链路。
   * 正式上线前改为 false，届时状态只能由机构端/后台变更。
   */
  demoMode: false,

  // 订单状态机：允许的状态与流转（与服务端保持一致，仅用于前端按钮显隐）
  ORDER_STATUS: {
    PENDING: '待接单',
    ACCEPTED: '已接单',
    SERVING: '服务中',
    SERVED: '待评价',
    DONE: '已完成',
    CANCELED: '已取消',
    REJECTED: '已拒单',
    AFTERSALE: '售后中'
  }
}
