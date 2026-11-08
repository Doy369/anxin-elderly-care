const app = getApp()
const store = require('../../../utils/store')

Page({
  data: {
    bigFont: false,
    form: { code: '', name: '', phone: '' },
    submitting: false
  },

  onLoad() {
    this.setData({ bigFont: app.globalData.bigFont })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    const patch = {}
    patch['form.' + field] = e.detail.value
    this.setData(patch)
  },

  submit() {
    if (this.data.submitting) return

    const f = this.data.form
    if (!f.code.trim()) return wx.showToast({ title: '请填写激活码', icon: 'none' })
    if (!f.name.trim()) return wx.showToast({ title: '请填写真实姓名', icon: 'none' })
    if (!/^1\d{10}$/.test(f.phone.trim())) return wx.showToast({ title: '手机号格式不对', icon: 'none' })

    this.setData({ submitting: true })
    wx.showLoading({ title: '认证中', mask: true })

    store.activateStaff({
      code: f.code.trim(),
      name: f.name.trim(),
      phone: f.phone.trim()
    }).then((res) => {
      wx.hideLoading()
      this.setData({ submitting: false })

      if (res && res.ok === false) {
        wx.showModal({ title: '认证失败', content: res.message, showCancel: false })
        return
      }

      wx.showModal({
        title: '认证成功',
        content: '现在可以去工单池接单了。',
        showCancel: false,
        success: () => wx.navigateBack()
      })
    }).catch((err) => {
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showModal({
        title: '认证失败',
        content: err.message || '请稍后重试',
        showCancel: false
      })
    })
  }
})
