/**
 * 全局配置
 *
 * 拿到 AppID 并开通云开发后，只需两步切换：
 *   1. 把 cloudEnv 填成你的云开发环境 ID（云开发控制台 → 设置 → 环境ID）
 *   2. 重新编译
 * 填了环境 ID 就自动走云端，没填就自动走本地，不需要改任何页面代码。
 */

// 例如 'cloud1-d5gl1cb3tac0ac224'
const CLOUD_ENV = 'cloud1-d5gl1cb3tac0ac224'

module.exports = {
  cloudEnv: CLOUD_ENV,
  // 环境 ID 存在即视为启用云端
  useCloud: !!CLOUD_ENV,
  // 云函数超时时间（毫秒）
  cloudTimeout: 10000,
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
