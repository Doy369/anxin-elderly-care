const store = require('../../utils/store')

const app = getApp()

function statusKey(status) {
  if (status === '待接单') return 'pending'
  if (status === '已接单') return 'accepted'
  if (status === '服务中') return 'serving'
  // 待评价要单独一档：它需要用户动手，不能和已完成一个颜色
  if (status === '待评价') return 'rate'
  if (status === '已完成') return 'done'
  return 'canceled'
}

Page({
  data: {
    filter: 'all',
    bigFont: false,
    list: [],
    emptyText: '还没有订单记录'
  },

  onShow() {
    this.setData({ bigFont: app.globalData.bigFont })
    this.refresh()
  },

  onPullDownRefresh() {
    this.refresh()
    wx.stopPullDownRefresh()
  },

  switchFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.f })
    this.refresh()
  },

  refresh() {
    const self = this
    const filter = this.data.filter

    store.getOrders().then(function (all) {
      let list = all

      if (filter === 'ongoing') {
        list = all.filter(function (item) {
          return ['待接单', '已接单', '服务中', '待评价'].indexOf(item.status) > -1
        })
      } else if (filter === 'done') {
        list = all.filter(function (item) {
          return item.status === '已完成' || item.status === '已取消'
        })
      }

      const emptyText = filter === 'all'
        ? '还没有订单记录'
        : (filter === 'ongoing' ? '当前没有进行中的服务' : '没有已完成的服务记录')

      self.setData({
        list: list.map(function (item) {
          return Object.assign({}, item, { statusKey: statusKey(item.status) })
        }),
        emptyText: emptyText
      })
    }).catch(function (err) {
      self.setData({ list: [], emptyText: err.message || '订单加载失败，请下拉重试' })
    })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + id })
  },

  contactWorker(e) {
    const id = e.currentTarget.dataset.id
    const hit = (this.data.list || []).find(function (o) { return o.id === id })

    if (!hit || !hit.staffName) {
      wx.showModal({
        title: '还没有服务人员',
        content: '接单后这里会显示师傅的姓名和电话。',
        showCancel: false
      })
      return
    }

    if (!hit.staffPhone) {
      wx.showModal({
        title: hit.staffName,
        content: '师傅还没留下联系电话，可以先联系客服转接。',
        showCancel: false
      })
      return
    }

    wx.showModal({
      title: '联系' + hit.staffName,
      content: hit.staffPhone,
      confirmText: '拨打',
      cancelText: '取消',
      success(res) {
        if (res.confirm) wx.makePhoneCall({ phoneNumber: hit.staffPhone })
      }
    })
  },

  goServices() {
    wx.switchTab({ url: '/pages/help/help' })
  }
})
