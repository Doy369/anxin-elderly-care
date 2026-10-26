const store = require('../../utils/store')

const app = getApp()

Page({
  data: {
    list: [],
    bigFont: false,
    relations: ['父亲', '母亲', '配偶', '爷爷', '奶奶', '外公', '外婆', '其他'],
    showForm: false,
    editingId: '',
    saving: false,
    form: {
      name: '',
      relation: '父亲',
      age: '',
      phone: '',
      address: '',
      note: ''
    }
  },

  onShow() {
    this.setData({ bigFont: app.globalData.bigFont })
    this.refresh()
  },

  refresh() {
    const self = this

    Promise.all([store.getFamilyMembers(), store.getOrders()]).then(function (r) {
      const members = r[0] || []
      const orders = r[1] || []

      const list = members.map(function (m) {
        const copy = Object.assign({}, m)
        copy.initial = (m.name || '家').charAt(0)
        copy.orderCount = orders.filter(function (o) {
          return o.elderId === m.id || o.forWhomId === m.id
        }).length
        return copy
      })

      self.setData({ list: list })
    }).catch(function (err) {
      self.setData({ list: [] })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    })
  },

  noop() {},

  onInput(e) {
    const field = e.currentTarget.dataset.field
    const form = Object.assign({}, this.data.form)
    form[field] = e.detail.value
    this.setData({ form: form })
  },

  pickRelation(e) {
    const form = Object.assign({}, this.data.form)
    form.relation = e.currentTarget.dataset.r
    this.setData({ form: form })
  },

  addMember() {
    this.editingId = ''
    this.setData({
      showForm: true,
      editingId: '',
      form: { name: '', relation: '父亲', age: '', phone: '', address: '', note: '' }
    })
  },

  editMember(e) {
    const id = e.currentTarget.dataset.id
    const member = this.data.list.find(function (m) {
      return m.id === id
    })
    if (!member) return
    this.editingId = id
    this.setData({
      showForm: true,
      editingId: id,
      form: {
        name: member.name || '',
        relation: member.relation || '父亲',
        age: member.age ? String(member.age) : '',
        phone: member.phone || '',
        address: member.address || '',
        note: member.note || ''
      }
    })
  },

  closeForm() {
    this.setData({ showForm: false })
  },

  save() {
    const f = this.data.form
    if (!f.name.trim()) {
      wx.showToast({ title: '请填写姓名', icon: 'none' })
      return
    }
    if (f.age && (Number(f.age) < 0 || Number(f.age) > 120)) {
      wx.showToast({ title: '年龄填写有误', icon: 'none' })
      return
    }
    if (f.phone && !/^1\d{10}$/.test(f.phone.trim())) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }
    if (this.data.saving) return
    this.setData({ saving: true })

    const payload = {
      name: f.name.trim(),
      relation: f.relation,
      age: f.age ? Number(f.age) : '',
      phone: f.phone.trim(),
      address: f.address.trim(),
      note: f.note.trim()
    }

    const editingId = this.data.editingId
    const task = editingId
      ? store.updateFamilyMember(editingId, payload)
      : store.addFamilyMember(payload)

    task.then((res) => {
      this.setData({ saving: false })
      if (res && res.ok === false) {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' })
        return
      }
      this.setData({ showForm: false })
      this.refresh()
      wx.showToast({ title: editingId ? '已更新' : '已添加', icon: 'success' })
    }).catch((err) => {
      this.setData({ saving: false })
      wx.showToast({ title: err.message || '保存失败', icon: 'none' })
    })
  },

  removeMember(e) {
    const id = e.currentTarget.dataset.id
    const member = this.data.list.find(function (m) {
      return m.id === id
    })
    wx.showModal({
      title: '删除家人档案',
      content: '确定删除「' + (member ? member.name : '') + '」的档案吗？已下单的订单不受影响。',
      confirmText: '删除',
      cancelText: '取消',
      confirmColor: '#5F7168',
      success: (res) => {
        if (!res.confirm) return
        store.removeFamilyMember(id).then((r) => {
          if (r && r.ok === false) {
            wx.showModal({ title: '无法删除', content: r.message, showCancel: false })
            return
          }
          this.refresh()
          wx.showToast({ title: '已删除', icon: 'none' })
        }).catch((err) => {
          wx.showToast({ title: err.message || '删除失败', icon: 'none' })
        })
      }
    })
  },

  quickBook(e) {
    wx.switchTab({ url: '/pages/services/services' })
    wx.showToast({
      title: '选择服务后可在服务对象中选择家人',
      icon: 'none',
      duration: 2200
    })
  }
})
