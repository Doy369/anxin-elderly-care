const app = getApp()
const store = require('../../utils/store')

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

function todayText() {
  const d = new Date()
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + week
}

Page({
  data: {
    bigFont: false,
    greeting: '你好',
    todayText: '',
    name: '张奶奶',
    activeOrder: null
  },

  onLoad() {
    this.setData({
      greeting: greeting(),
      todayText: todayText()
    })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }

    const user = app.globalData.userInfo || {}
    this.setData({
      bigFont: app.globalData.bigFont,
      name: user.nickname || '张奶奶'
    })

    this.loadActiveOrder()
  },

  onPullDownRefresh() {
    this.loadActiveOrder()
    wx.stopPullDownRefresh()
  },

  loadActiveOrder() {
    const self = this
    store.getOrders().then(function (list) {
      const active = (list || []).filter(function (o) {
        return ['待接单', '已接单', '服务中', '待评价'].indexOf(o.status) > -1
      })
      self.setData({ activeOrder: active[0] || null })
    }).catch(function () {
      self.setData({ activeOrder: null })
    })
  },

  goHelp() {
    wx.switchTab({ url: '/pages/help/help' })
  },

  goMyHome() {
    wx.switchTab({ url: '/pages/myhome/myhome' })
  },

  goOrders() {
    wx.navigateTo({ url: '/pages/orders/orders' })
  },

  goOrderDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + id })
  },

  callService() {
    wx.showModal({
      title: '客服热线',
      content: '400-800-1234\n服务时间 8:00 - 20:00',
      confirmText: '拨打',
      cancelText: '取消',
      success(res) {
        if (res.confirm) wx.makePhoneCall({ phoneNumber: '4008001234' })
      }
    })
  }
})
