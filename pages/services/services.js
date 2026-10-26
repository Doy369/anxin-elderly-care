const data = require('../../utils/data')

const app = getApp()

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
    categories: data.CATEGORIES,
    activeCat: 'all',
    bigFont: false,
    keyword: '',
    list: []
  },

  onLoad(options) {
    const cat = options.cat || 'all'
    this.setData({ activeCat: cat })
    this.refresh()
  },

  onShow() {
    this.setData({ bigFont: app.globalData.bigFont })
    this.refresh()
  },

  switchCat(e) {
    this.setData({ activeCat: e.currentTarget.dataset.id })
    this.refresh()
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value })
    this.refresh()
  },

  clearSearch() {
    this.setData({ keyword: '' })
    this.refresh()
  },

  refresh() {
    const keyword = this.data.keyword.trim()
    let list = data.getServicesByCategory(this.data.activeCat)

    if (keyword) {
      const lower = keyword.toLowerCase()
      list = list.filter(function (s) {
        const haystack = (s.name + s.desc + s.provider + s.tags.join('')).toLowerCase()
        return haystack.indexOf(lower) > -1
      })
    }

    this.setData({ list: list.map(decorate) })
  },

  goBooking(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/booking/booking?id=' + id })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/booking/booking?id=' + id + '&focus=detail' })
  }
})
