const app = getApp()
const store = require('../../utils/store')

Page({
  data: {
    avatarText: '王',
    bigFont: false,
    mode: 'elder',
    stats: { total: 0, ongoing: 0, family: 0 }
  },

  onShow() {
    const self = this
    const mode = app.globalData.mode || store.getMode()

    Promise.all([store.getOrders(), store.getFamilyMembers()]).then(function (r) {
      const orders = r[0] || []
      const members = r[1] || []
      self.setData({
        mode: mode,
        bigFont: app.globalData.bigFont,
        stats: {
          total: orders.length,
          ongoing: orders.filter(function (o) {
            return ['待接单', '已接单', '服务中', '待评价'].indexOf(o.status) > -1
          }).length,
          family: members.length
        }
      })
    }).catch(function () {
      self.setData({
        mode: mode,
        bigFont: app.globalData.bigFont,
        stats: { total: 0, ongoing: 0, family: 0 }
      })
    })
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode
    app.setMode(mode)
    this.setData({ mode: mode })
    wx.showToast({ title: mode === 'family' ? '已切换到家人代下单' : '已切换到本人使用', icon: 'none' })
  },

  toggleBigFont() {
    const next = !this.data.bigFont
    app.setBigFont(next)
    this.setData({ bigFont: next })
    wx.showToast({
      title: next ? '已开启超大字体' : '已恢复标准字体',
      icon: 'none'
    })
  },

  goFamily() {
    wx.navigateTo({ url: '/pages/family/family' })
  },

  goOrders() {
    wx.switchTab({ url: '/pages/orders/orders' })
  },

  goServices() {
    wx.switchTab({ url: '/pages/services/services?cat=install' })
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
  },

  showAbout() {
    wx.showModal({
      title: '关于安心养老',
      content: '平台提供适老化家居安装改造与居家养老服务预约。\n\n服务人员均实名认证，服务过程全程留痕，子女可远程查看服务记录。\n\n客服热线 400-800-1234',
      showCancel: false,
      confirmText: '知道了'
    })
  }
})
