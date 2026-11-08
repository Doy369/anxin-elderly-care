const app = getApp()
const store = require('../../utils/store')
const design = require('../../utils/design')

function dateText(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return (d.getMonth() + 1) + '月' + d.getDate() + '日'
}

Page({
  data: {
    bigFont: false,
    homeId: '',
    roomType: '',
    room: {},
    items: [],
    photo: null,
    uploading: false,
    checkedCount: 0
  },

  onLoad(options) {
    const roomType = options.id || 'living'
    const room = design.getRoom(roomType) || design.ROOMS[0]

    this.setData({
      bigFont: app.globalData.bigFont,
      homeId: options.homeId || '',
      roomType: roomType,
      room: room,
      items: this.buildItems([])
    })

    wx.setNavigationBarTitle({ title: room.name })
  },

  onShow() {
    if (!this.data.homeId) {
      this.resolveHome()
      return
    }
    this.loadAssets()
  },

  /** 直接分享进入时没带 homeId，取当前房屋兜底 */
  resolveHome() {
    const self = this
    store.getHomes().then(function (homes) {
      const saved = wx.getStorageSync('currentHomeId') || ''
      const hit = (homes || []).find(function (h) { return h.id === saved }) || (homes || [])[0]
      if (!hit) return
      self.setData({ homeId: hit.id })
      self.loadAssets()
    }).catch(function () {})
  },

  buildItems(checked) {
    const raw = design.ROOM_ITEMS[this.data.roomType] || []
    return raw.map(function (text, i) {
      return { text: text, checked: checked.indexOf(i) > -1 }
    })
  },

  loadAssets() {
    const self = this
    store.getRoomAssets(this.data.homeId).then(function (assets) {
      const a = (assets && assets[self.data.roomType]) || {}
      const checks = a.checks || []

      self.setData({
        items: self.buildItems(checks),
        checkedCount: checks.length,
        photo: a.fileID
          ? { fileID: a.fileID, updatedAt: a.photoUpdatedAt, dateText: dateText(a.photoUpdatedAt) }
          : null
      })
    }).catch(function (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    })
  },

  toggleItem(e) {
    const index = Number(e.currentTarget.dataset.index)
    const items = this.data.items.map(function (item, i) {
      if (i === index) return { text: item.text, checked: !item.checked }
      return item
    })

    const checks = []
    items.forEach(function (item, i) {
      if (item.checked) checks.push(i)
    })

    this.setData({ items: items, checkedCount: checks.length })

    // 勾选是给师傅看的，必须上云，否则换设备就没了
    store.setRoomChecks(this.data.homeId, this.data.roomType, checks).catch(function () {
      wx.showToast({ title: '保存失败，请检查网络', icon: 'none' })
    })
  },

  choosePhoto() {
    if (this.data.uploading) return
    const self = this

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success(res) {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file) return
        self.upload(file.tempFilePath)
      },
      fail(err) {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') > -1) return
        wx.showToast({ title: '选择图片失败', icon: 'none' })
      }
    })
  },

  upload(localPath) {
    const self = this
    const homeId = this.data.homeId
    const roomType = this.data.roomType

    if (!homeId) {
      wx.showToast({ title: '房屋信息未加载，请稍后重试', icon: 'none' })
      return
    }

    self.setData({ uploading: true })
    wx.showLoading({ title: '上传中', mask: true })

    store.uploadImage(localPath, homeId, roomType).then(function (fileID) {
      return store.saveRoomPhoto(homeId, roomType, fileID)
    }).then(function (res) {
      wx.hideLoading()
      self.setData({ uploading: false })
      if (res && res.ok === false) {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' })
        return
      }
      self.loadAssets()
      wx.showToast({ title: '已保存', icon: 'success' })
    }).catch(function (err) {
      wx.hideLoading()
      self.setData({ uploading: false })
      wx.showModal({
        title: '上传失败',
        content: err.message || '请稍后重试',
        showCancel: false
      })
    })
  },

  previewPhoto() {
    if (!this.data.photo) return
    wx.previewImage({ urls: [this.data.photo.fileID], current: this.data.photo.fileID })
  },

  removePhoto() {
    const self = this
    wx.showModal({
      title: '删除照片',
      content: '确定删除这张实拍图吗？',
      confirmText: '删除',
      cancelText: '取消',
      confirmColor: '#5F7165',
      success(res) {
        if (!res.confirm) return
        store.removeRoomPhoto(self.data.homeId, self.data.roomType).then(function () {
          self.setData({ photo: null })
          wx.showToast({ title: '已删除', icon: 'none' })
        }).catch(function (err) {
          wx.showToast({ title: err.message || '删除失败', icon: 'none' })
        })
      }
    })
  },

  goDesign() {
    wx.navigateTo({
      url: '/pages/booking/booking?service=design'
        + '&homeId=' + this.data.homeId
        + '&room=' + this.data.roomType
        + '&from=' + encodeURIComponent(this.data.room.name)
    })
  },

  goBooking() {
    wx.navigateTo({
      url: '/pages/booking/booking?service=repair'
        + '&homeId=' + this.data.homeId
        + '&room=' + this.data.roomType
        + '&from=' + encodeURIComponent(this.data.room.name)
    })
  },

  onShareAppMessage() {
    return {
      title: this.data.room.name + '适老化改造参考',
      path: '/pages/myhome/myhome'
    }
  }
})
