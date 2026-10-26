const app = getApp()
const store = require('../../utils/store')
const data = require('../../utils/data')

function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

function todayStr() {
  const d = new Date()
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function defaultDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function formatCount(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return String(n)
}

Page({
  data: {
    service: {},
    timeSlots: data.TIME_SLOTS,
    today: todayStr(),
    bigFont: false,
    mode: 'elder',
    members: [],
    quantityLabel: '服务数量',
    quantityHint: '',
    estimate: '0',
    locating: false,
    form: {
      forWhom: '本人',
      forWhomId: '',
      contactName: '',
      phone: '',
      address: '',
      date: '',
      timeSlot: '',
      quantity: 1,
      remark: '',
      familyPhone: ''
    }
  },

  onLoad(options) {
    const service = data.getServiceById(options.id)
    if (!service) {
      wx.showToast({ title: '服务不存在', icon: 'none' })
      setTimeout(function () {
        wx.navigateBack()
      }, 1200)
      return
    }

    this.setData({ bigFont: app.globalData.bigFont })

    const serviceCopy = Object.assign({}, service, {
      orderCountText: formatCount(service.orderCount)
    })

    // 按时长计费的服务，数量单位为小时/次；改造类按套
    const isHourly = ['install'].indexOf(service.category) === -1
    const quantityLabel = isHourly ? service.unit + '数（如小时/次）' : '施工套数'

    this.setData({
      service: serviceCopy,
      quantityLabel: quantityLabel,
      quantityHint: isHourly ? service.unit + ' × ¥' + service.price + ' 起' : '以现场测量为准'
    })

    if (options.focus === 'detail') {
      setTimeout(function () {
        wx.pageScrollTo({ selector: '#detail', duration: 300 })
      }, 200)
    }
  },

  onShow() {
    const self = this
    self.setData({
      bigFont: app.globalData.bigFont,
      mode: app.globalData.mode || store.getMode()
    })

    store.getFamilyMembers().then(function (members) {
      self.setData({ members: members })
    }).catch(function () {
      self.setData({ members: [] })
    })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    const form = Object.assign({}, this.data.form)
    form[field] = value
    this.setData({ form: form })
    if (field === 'quantity') this.recalc()
  },

  pickWho(e) {
    const form = Object.assign({}, this.data.form)
    form.forWhom = e.currentTarget.dataset.name
    form.forWhomId = e.currentTarget.dataset.id || ''
    this.setData({ form: form })
  },

  goFamily() {
    wx.navigateTo({ url: '/pages/family/family' })
  },

  onDateChange(e) {
    const form = Object.assign({}, this.data.form)
    form.date = e.detail.value
    this.setData({ form: form })
  },

  pickSlot(e) {
    const form = Object.assign({}, this.data.form)
    form.timeSlot = e.currentTarget.dataset.slot
    this.setData({ form: form })
  },

  plusQty() {
    const form = Object.assign({}, this.data.form)
    form.quantity = Math.min(99, (Number(form.quantity) || 0) + 1)
    this.setData({ form: form })
    this.recalc()
  },

  minusQty() {
    const form = Object.assign({}, this.data.form)
    form.quantity = Math.max(1, (Number(form.quantity) || 1) - 1)
    this.setData({ form: form })
    this.recalc()
  },

  useCurrentLocation() {
    this.setData({ locating: true })
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({ locating: false })
        wx.showToast({ title: '已定位，请补充详细门牌', icon: 'none' })
      },
      fail: () => {
        this.setData({ locating: false })
        wx.showModal({
          title: '无法获取位置',
          content: '请检查定位权限，或直接手动填写详细地址',
          showCancel: false,
          confirmText: '知道了'
        })
      }
    })
  },

  recalc() {
    const svc = this.data.service
    const qty = Number(this.data.form.quantity) || 1
    const total = (Number(svc.price) || 0) * qty
    this.setData({ estimate: String(total) })
  },

  validate() {
    const f = this.data.form
    if (!f.contactName.trim()) return '请填写联系人姓名'
    if (!/^1\d{10}$/.test(f.phone.trim())) return '请填写正确的11位手机号'
    if (!f.address.trim()) return '请填写上门地址'
    if (!f.date) return '请选择上门日期'
    if (!f.timeSlot) return '请选择上门时段'
    if (f.familyPhone && !/^1\d{10}$/.test(f.familyPhone.trim())) return '家属手机号格式不正确'
    return ''
  },

  submit() {
    const err = this.validate()
    if (err) {
      wx.showModal({ title: '还差一点', content: err, showCancel: false, confirmText: '去填写' })
      return
    }

    const svc = this.data.service
    const f = this.data.form
    const qty = Number(f.quantity) || 1
    const now = Date.now()

    const order = {
      id: 'AX' + now,
      userId: '',
      elderId: f.forWhomId || '',
      serviceId: svc.id,
      serviceName: svc.name,
      icon: svc.icon,
      provider: svc.provider,
      unit: svc.unit,
      price: Number(svc.price) || 0,
      quantity: qty,
      amount: (Number(svc.price) || 0) * qty,
      forWhom: f.forWhom,
      contactName: f.contactName.trim(),
      phone: f.phone.trim(),
      address: f.address.trim(),
      date: f.date,
      timeSlot: f.timeSlot,
      remark: f.remark.trim(),
      familyPhone: f.familyPhone.trim(),
      bookedBy: this.data.mode === 'family' ? '子女代下单' : '本人下单',
      status: '待接单',
      createdAt: now,
      records: []
    }

    wx.showLoading({ title: '提交中', mask: true })

    store.addOrder(order).then((res) => {
      wx.hideLoading()
      if (!res || res.ok === false) {
        wx.showModal({
          title: '提交失败',
          content: (res && res.message) || '请稍后重试',
          showCancel: false
        })
        return
      }

      const created = res.order || order
      const showId = created.orderNo || created.id || order.id

      wx.showModal({
        title: '预约成功',
        content: '服务人员将尽快与您电话确认上门时间。\n\n订单号：' + showId + '\n可在「我的订单」查看进度',
        confirmText: '查看订单',
        cancelText: '返回首页',
        success: (r) => {
          if (r.confirm) {
            wx.redirectTo({ url: '/pages/order-detail/order-detail?id=' + created.id })
          } else {
            wx.switchTab({ url: '/pages/index/index' })
          }
        }
      })
    }).catch((err) => {
      wx.hideLoading()
      wx.showModal({
        title: '提交失败',
        content: err.message || '网络异常，请稍后重试',
        showCancel: false
      })
    })
  }
})
