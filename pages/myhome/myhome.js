const app = getApp()
const store = require('../../utils/store')
const design = require('../../utils/design')

const EMPTY_FORM = {
  name: '',
  address: '',
  area: '',
  floor: '',
  elevator: false,
  remark: ''
}

Page({
  data: {
    bigFont: false,
    homes: [],
    currentHomeId: '',
    currentHome: {},
    rooms: design.ROOMS,

    showHomeSheet: false,
    showForm: false,
    editingId: '',
    form: EMPTY_FORM,
    saving: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.setData({ bigFont: app.globalData.bigFont })
    this.loadHomes()
  },

  onPullDownRefresh() {
    this.loadHomes()
    wx.stopPullDownRefresh()
  },

  /* ---------- 房屋 ---------- */
  loadHomes() {
    const self = this
    store.getHomes().then(function (homes) {
      const list = homes || []
      if (list.length === 0) {
        self.setData({ homes: [], currentHome: {}, rooms: design.ROOMS })
        return
      }

      let current = wx.getStorageSync('currentHomeId') || ''
      if (!list.some(function (h) { return h.id === current })) {
        current = list[0].id
        wx.setStorageSync('currentHomeId', current)
      }

      const hit = list.find(function (h) { return h.id === current }) || list[0]

      self.setData({
        homes: list,
        currentHomeId: current,
        currentHome: hit
      })

      self.loadAssets(current)
    }).catch(function (err) {
      self.setData({ homes: [], rooms: design.ROOMS })
      wx.showToast({ title: err.message || '房屋加载失败', icon: 'none' })
    })
  },

  loadAssets(homeId) {
    const self = this
    store.getRoomAssets(homeId).then(function (assets) {
      const rooms = design.ROOMS.map(function (room) {
        const a = assets && assets[room.id]
        return Object.assign({}, room, {
          photo: a && a.fileID ? a.fileID : '',
          checkedCount: a && a.checks ? a.checks.length : 0
        })
      })
      self.setData({ rooms: rooms })
    }).catch(function () {
      self.setData({ rooms: design.ROOMS })
    })
  },

  openHomeSheet() {
    this.setData({ showHomeSheet: true })
  },

  closeHomeSheet() {
    this.setData({ showHomeSheet: false })
  },

  switchHome(e) {
    const id = e.currentTarget.dataset.id
    if (id === this.data.currentHomeId) {
      this.setData({ showHomeSheet: false })
      return
    }
    const hit = this.data.homes.find(function (h) { return h.id === id })
    wx.setStorageSync('currentHomeId', id)
    this.setData({
      currentHomeId: id,
      currentHome: hit || {},
      showHomeSheet: false,
      rooms: design.ROOMS
    })
    this.loadAssets(id)
  },

  noop() {},

  /* ---------- 新增 / 编辑 ---------- */
  addHome() {
    this.setData({
      showHomeSheet: false,
      showForm: true,
      editingId: '',
      form: Object.assign({}, EMPTY_FORM)
    })
  },

  editHome(e) {
    const id = e.currentTarget.dataset.id
    const hit = this.data.homes.find(function (h) { return h.id === id })
    if (!hit) return

    this.setData({
      showHomeSheet: false,
      showForm: true,
      editingId: id,
      form: {
        name: hit.name || '',
        address: hit.address || '',
        area: hit.area ? String(hit.area) : '',
        floor: hit.floor ? String(hit.floor) : '',
        elevator: !!hit.elevator,
        remark: hit.remark || ''
      }
    })
  },

  closeForm() {
    this.setData({ showForm: false })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    const patch = {}
    patch['form.' + field] = e.detail.value
    this.setData(patch)
  },

  toggleElevator() {
    this.setData({ 'form.elevator': !this.data.form.elevator })
  },

  saveHome() {
    if (this.data.saving) return
    const f = this.data.form

    if (!f.name.trim()) {
      wx.showToast({ title: '请填写房屋名称', icon: 'none' })
      return
    }

    this.setData({ saving: true })

    const payload = {
      name: f.name.trim(),
      address: f.address.trim(),
      area: f.area ? Number(f.area) : 0,
      floor: f.floor ? Number(f.floor) : 0,
      elevator: !!f.elevator,
      remark: f.remark.trim()
    }

    const editingId = this.data.editingId
    const task = editingId
      ? store.updateHome(editingId, payload)
      : store.addHome(payload)

    task.then((res) => {
      this.setData({ saving: false })
      if (res && res.ok === false) {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' })
        return
      }
      const home = res.home
      if (!editingId && home && home.id) {
        wx.setStorageSync('currentHomeId', home.id)
      }
      this.setData({ showForm: false })
      this.loadHomes()
      wx.showToast({ title: editingId ? '已更新' : '已添加', icon: 'success' })
    }).catch((err) => {
      this.setData({ saving: false })
      wx.showToast({ title: err.message || '保存失败', icon: 'none' })
    })
  },

  removeHome(e) {
    const id = e.currentTarget.dataset.id
    const hit = this.data.homes.find(function (h) { return h.id === id })
    if (!hit) return

    if (this.data.homes.length <= 1) {
      wx.showToast({ title: '至少保留一套房屋', icon: 'none' })
      return
    }

    const self = this
    wx.showModal({
      title: '删除房屋',
      content: '确定删除「' + (hit.name || '') + '」吗？房间照片也会一并删除。',
      confirmText: '删除',
      cancelText: '取消',
      confirmColor: '#5F7165',
      success(res) {
        if (!res.confirm) return
        store.removeHome(id).then(function (r) {
          if (r && r.ok === false) {
            wx.showModal({ title: '无法删除', content: r.message, showCancel: false })
            return
          }
          wx.removeStorageSync('currentHomeId')
          self.setData({ showHomeSheet: false })
          self.loadHomes()
          wx.showToast({ title: '已删除', icon: 'none' })
        }).catch(function (err) {
          wx.showToast({ title: err.message || '删除失败', icon: 'none' })
        })
      }
    })
  },

  /* ---------- 房间 ---------- */
  openRoom(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/room/room?id=' + id + '&homeId=' + this.data.currentHomeId
    })
  }
})
