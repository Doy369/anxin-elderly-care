const app = getApp()
const store = require('../../../utils/store')
const design = require('../../../utils/design')

function roomLabel(code) {
  const r = design.getRoom(code)
  return r ? r.name : ''
}

Page({
  data: {
    bigFont: false,
    orderId: '',
    order: null,
    logs: [],
    staff: null,
    isMine: false,
    roomLabel: '',
    statusText: '',

    showFinish: false,
    note: '',
    photos: [],
    submitting: false,

    homePhotos: [],
    homePhotosLoaded: false
  },

  onLoad(options) {
    this.setData({ bigFont: app.globalData.bigFont, orderId: options.id })
  },

  onShow() {
    this.load()
  },

  load() {
    const self = this
    Promise.all([store.getStaffMe(), store.getOrderById(this.data.orderId)])
      .then(function (res) {
        const me = res[0] || {}
        const order = res[1]
        if (!order) {
          wx.showModal({
            title: '工单不存在',
            content: '可能已被取消或删除',
            showCancel: false,
            success: function () { wx.navigateBack() }
          })
          return
        }

        const staff = me.staff || null
        self.setData({
          staff: staff,
          order: order,
          isMine: !!(staff && order.staffId && order.staffId === staff.id),
          roomLabel: roomLabel(order.roomType),
          statusText: order.status
        })

        if (order.homeId) self.loadHomePhotos(order.homeId, order.roomType)
      })
      .catch(function (err) {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      })
  },

  /** 业主上传的房屋实景，本单房间排最前 */
  loadHomePhotos(homeId, focusRoom) {
    const self = this
    store.getRoomAssets(homeId).then(function (assets) {
      const list = []
      design.ROOMS.forEach(function (room) {
        const a = assets && assets[room.id]
        if (a && a.fileID) {
          list.push({
            roomType: room.id,
            roomName: room.name,
            fileID: a.fileID,
            checked: (a.checks || []).length
          })
        }
      })

      list.sort(function (x, y) {
        if (x.roomType === focusRoom) return -1
        if (y.roomType === focusRoom) return 1
        return 0
      })

      self.setData({ homePhotos: list, homePhotosLoaded: true })
    }).catch(function () {
      self.setData({ homePhotos: [], homePhotosLoaded: true })
    })
  },

  callCustomer() {
    const phone = this.data.order && this.data.order.phone
    if (!phone) return
    if (phone.indexOf('*') > -1) {
      wx.showToast({ title: '接单后可查看完整号码', icon: 'none' })
      return
    }
    wx.makePhoneCall({ phoneNumber: phone })
  },

  openMap() {
    const addr = this.data.order && this.data.order.address
    if (!addr) return
    wx.setClipboardData({
      data: addr,
      success: function () {
        wx.showToast({ title: '地址已复制', icon: 'none' })
      }
    })
  },

  /* ---------- 接单 ---------- */
  acceptOrder() {
    const self = this
    wx.showModal({
      title: '确认接单',
      content: '接单后请按约定时间上门，完成时需要上传现场照片。',
      confirmText: '接这一单',
      cancelText: '再看看',
      success(res) {
        if (!res.confirm) return
        wx.showLoading({ title: '接单中', mask: true })
        store.acceptOrder(self.data.orderId).then(function (r) {
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

  /* ---------- 打卡 ---------- */
  arrive() {
    const self = this
    wx.showModal({
      title: '确认到达',
      content: '确认已到达服务地址并开始服务？',
      confirmText: '已到达',
      cancelText: '取消',
      success(res) {
        if (!res.confirm) return
        wx.showLoading({ title: '打卡中', mask: true })
        store.arriveOrder(self.data.orderId).then(function (r) {
          wx.hideLoading()
          if (r && r.ok === false) {
            wx.showToast({ title: r.message, icon: 'none' })
            return
          }
          wx.showToast({ title: '已开始服务', icon: 'success' })
          self.load()
        }).catch(function (err) {
          wx.hideLoading()
          wx.showToast({ title: err.message || '打卡失败', icon: 'none' })
        })
      }
    })
  },

  /* ---------- 完成 ---------- */
  openFinish() {
    this.setData({ showFinish: true, note: '', photos: [] })
  },

  closeFinish() {
    this.setData({ showFinish: false })
  },

  noop() {},

  onNote(e) {
    this.setData({ note: e.detail.value })
  },

  choosePhotos() {
    const left = 3 - this.data.photos.length
    if (left <= 0) {
      wx.showToast({ title: '最多 3 张', icon: 'none' })
      return
    }
    const self = this
    wx.chooseMedia({
      count: left,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success(res) {
        const paths = (res.tempFiles || []).map(function (f) { return f.tempFilePath })
        self.setData({ photos: self.data.photos.concat(paths).slice(0, 3) })
      }
    })
  },

  removePhoto(e) {
    const index = Number(e.currentTarget.dataset.index)
    const photos = this.data.photos.filter(function (p, i) { return i !== index })
    this.setData({ photos: photos })
  },

  previewPhoto(e) {
    const src = e.currentTarget.dataset.src
    wx.previewImage({ urls: [src], current: src })
  },

  submitFinish() {
    if (this.data.submitting) return

    if (!this.data.note.trim()) {
      wx.showToast({ title: '请简单写一句服务情况', icon: 'none' })
      return
    }
    if (this.data.photos.length === 0) {
      wx.showToast({ title: '请至少上传一张现场照片', icon: 'none' })
      return
    }

    const self = this
    const orderId = this.data.orderId
    self.setData({ submitting: true })
    wx.showLoading({ title: '提交中', mask: true })

    Promise.all(self.data.photos.map(function (p) {
      return store.uploadWorkPhoto(p, orderId)
    })).then(function (fileIDs) {
      return store.finishOrder(orderId, fileIDs, self.data.note.trim())
    }).then(function (r) {
      wx.hideLoading()
      self.setData({ submitting: false })
      if (r && r.ok === false) {
        wx.showModal({ title: '提交失败', content: r.message, showCancel: false })
        return
      }
      self.setData({ showFinish: false })
      wx.showToast({ title: '已完成', icon: 'success' })
      self.load()
    }).catch(function (err) {
      wx.hideLoading()
      self.setData({ submitting: false })
      wx.showModal({
        title: '提交失败',
        content: err.message || '请稍后重试',
        showCancel: false
      })
    })
  }
})
