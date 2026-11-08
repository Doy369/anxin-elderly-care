const app = getApp()
const store = require('../../utils/store')
const design = require('../../utils/design')

function roomLabel(code) {
  const r = design.getRoom(code)
  return r ? r.name : ''
}

function decorate(list) {
  return (list || []).map(function (o) {
    return Object.assign({}, o, {
      roomLabel: roomLabel(o.roomType),
      amountText: (Number(o.amount) || 0) > 0 ? '¥' + o.amount : '面议'
    })
  })
}

Page({
  data: {
    bigFont: false,
    staff: null,
    noAuth: false,
    tab: 'pool',
    pool: [],
    mine: [],
    loading: true
  },

  onShow() {
    this.setData({ bigFont: app.globalData.bigFont })
    this.load()
  },

  onPullDownRefresh() {
    this.load()
    wx.stopPullDownRefresh()
  },

  load() {
    const self = this
    self.setData({ loading: true })

    store.getStaffMe().then(function (r) {
      if (!r || !r.staff) {
        self.setData({ noAuth: true, staff: null, loading: false })
        return null
      }
      self.setData({ noAuth: false, staff: r.staff })
      return Promise.all([store.getOrderPool(), store.getMyWorkOrders()])
    }).then(function (res) {
      if (!res) return
      self.setData({
        pool: decorate(res[0]),
        mine: decorate(res[1]),
        loading: false
      })
    }).catch(function (err) {
      self.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    })
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/staff/detail/detail?id=' + id })
  },

  acceptOrder(e) {
    const id = e.currentTarget.dataset.id
    const self = this

    wx.showModal({
      title: '确认接单',
      content: '接单后请按约定时间上门，服务完成需要上传现场照片。',
      confirmText: '接这一单',
      cancelText: '再看看',
      success(res) {
        if (!res.confirm) return
        wx.showLoading({ title: '接单中', mask: true })
        store.acceptOrder(id).then(function (r) {
          wx.hideLoading()
          if (r && r.ok === false) {
            wx.showModal({ title: '没接上', content: r.message, showCancel: false })
            self.load()
            return
          }
          wx.showToast({ title: '接单成功', icon: 'success' })
          self.load()
        }).catch(function (err) {
          wx.hideLoading()
          wx.showToast({ title: err.message || '接单失败', icon: 'none' })
        })
      }
    })
  },

  goActivate() {
    wx.navigateTo({ url: '/pages/staff/activate/activate' })
  },

  callCustomer(e) {
    const phone = e.currentTarget.dataset.phone
    if (!phone || phone.indexOf('*') > -1) {
      wx.showToast({ title: '接单后可查看完整号码', icon: 'none' })
      return
    }
    wx.makePhoneCall({ phoneNumber: phone })
  }
})
