const app = getApp()
const design = require('../../utils/design')

Page({
  data: {
    bigFont: false,
    services: design.SERVICES
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.setData({ bigFont: app.globalData.bigFont })
  },

  goService(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/booking/booking?service=' + id })
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
