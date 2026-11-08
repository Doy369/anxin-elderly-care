const app = getApp()
const store = require('../../utils/store')

// 资料占位：等「资料编辑」做出来后从云端 users 表读取
const FALLBACK = {
  name: '张奶奶',
  meta: '70岁 · 150****8888'
}

Page({
  data: {
    bigFont: false,
    name: FALLBACK.name,
    meta: FALLBACK.meta,
    avatarEmoji: '👵'
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 })
    }

    const user = app.globalData.userInfo || {}
    this.setData({
      bigFont: app.globalData.bigFont,
      name: user.nickname || FALLBACK.name,
      meta: user.phone ? ('70岁 · ' + user.phone) : FALLBACK.meta
    })
  },

  toggleBigFont() {
    const next = !this.data.bigFont
    app.setBigFont(next)
    this.setData({ bigFont: next })
    wx.showToast({
      title: next ? '已开启大字体' : '已恢复标准字体',
      icon: 'none'
    })
  },

  editProfile() {
    wx.showToast({ title: '资料编辑开发中', icon: 'none' })
  },

  goFamily() {
    wx.navigateTo({ url: '/pages/family/family' })
  },

  goMyHome() {
    wx.switchTab({ url: '/pages/myhome/myhome' })
  },

  goOrders() {
    wx.navigateTo({ url: '/pages/orders/orders' })
  },

  goFavorites() {
    wx.showToast({ title: '收藏功能开发中', icon: 'none' })
  },

  goStaff() {
    store.getStaffMe().then(function (r) {
      if (r && r.staff) {
        wx.navigateTo({ url: '/pages/staff/home' })
      } else {
        wx.navigateTo({ url: '/pages/staff/activate/activate' })
      }
    }).catch(function () {
      wx.navigateTo({ url: '/pages/staff/activate/activate' })
    })
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
