const app = getApp()
const store = require('../../utils/store')
const data = require('../../utils/data')

function hourGreeting() {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

function formatCount(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return String(n)
}

function decorate(service) {
  return Object.assign({}, service, {
    orderCountText: formatCount(service.orderCount)
  })
}

Page({
  data: {
    greeting: '',
    nickname: '王阿姨',
    avatarText: '王',
    bigFont: false,
    mode: 'elder',
    modeText: '为您自己的健康和生活安排服务',
    quickEntries: [
      { icon: '🔧', name: '家居改造', desc: '防滑扶手', cat: 'install' },
      { icon: '🩺', name: '上门护理', desc: '持证护理员', cat: 'homecare' },
      { icon: '🚿', name: '助浴洗澡', desc: '安全洗浴', cat: 'assist' },
      { icon: '🍲', name: '助餐送餐', desc: '少油少盐', cat: 'assist' }
    ],
    installList: [],
    careList: [],
    activeOrders: []
  },

  onLoad() {
    this.setData({ bigFont: app.globalData.bigFont })
    this.refreshGreeting()
  },

  onShow() {
    this.applyMode()
    this.loadServices()
    this.loadOrders()
  },

  onPullDownRefresh() {
    this.refreshGreeting()
    this.loadOrders()
    wx.stopPullDownRefresh()
  },

  refreshGreeting() {
    this.setData({ greeting: hourGreeting() })
  },

  applyMode() {
    const mode = app.globalData.mode || store.getMode()
    this.setData({
      mode: mode,
      modeText: mode === 'family'
        ? '为家人下单，服务进度会同步给家人'
        : '为您自己的健康和生活安排服务'
    })
  },

  loadServices() {
    this.setData({
      installList: data.getServicesByCategory('install').slice(0, 3).map(decorate),
      careList: data.getServicesByCategory('homecare').map(decorate)
    })
  },

  loadOrders() {
    const self = this
    store.getOrders().then(function (orders) {
      const list = orders.filter(function (item) {
        return item.status !== '已取消' && item.status !== '已完成'
      })
      self.setData({
        activeOrders: list.map(function (item) {
          return Object.assign({}, item, {
            statusKey: item.status === '待接单'
              ? 'pending'
              : (item.status === '服务中' ? 'serving' : (item.status === '待评价' ? 'done' : 'accepted'))
          })
        })
      })
    }).catch(function (err) {
      self.setData({ activeOrders: [] })
      wx.showToast({ title: err.message || '订单加载失败', icon: 'none' })
    })
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode
    app.setMode(mode)
    this.applyMode()
    wx.showToast({ title: mode === 'family' ? '已切换到家人代下单' : '已切换到本人使用', icon: 'none' })
  },

  callService() {
    wx.showModal({
      title: '客服热线',
      content: '400-800-1234\n服务时间 8:00 - 20:00',
      confirmText: '拨打',
      cancelText: '取消',
      success(res) {
        if (res.confirm) {
          wx.makePhoneCall({ phoneNumber: '4008001234' })
        }
      }
    })
  },

  goCategory(e) {
    const cat = e.currentTarget.dataset.cat
    wx.switchTab({
      url: '/pages/services/services?cat=' + cat
    })
  },

  goInstallAll() {
    wx.switchTab({ url: '/pages/services/services?cat=install' })
  },

  goCareAll() {
    wx.switchTab({ url: '/pages/services/services?cat=homecare' })
  },

  goService(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/booking/booking?id=' + id })
  },

  goOrderDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + id })
  },

  contactWorker(e) {
    wx.showModal({
      title: '联系服务人员',
      content: '服务人员：陈师傅\n联系电话：138 0000 0000',
      confirmText: '拨打',
      cancelText: '取消',
      success(res) {
        if (res.confirm) {
          wx.makePhoneCall({ phoneNumber: '13800000000' })
        }
      }
    })
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' })
  }
})
