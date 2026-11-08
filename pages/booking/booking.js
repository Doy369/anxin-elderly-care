const app = getApp()
const store = require('../../utils/store')
const design = require('../../utils/design')

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

// 从「我的家」带过来的房间名可能是编码过的，解不开就原样用
function safeDecode(v) {
  if (!v) return ''
  try {
    return decodeURIComponent(v)
  } catch (e) {
    return v
  }
}

Page({
  data: {
    bigFont: false,
    step: 1,
    steps: ['选择', '预约信息', '确认提交'],
    service: {},
    companions: design.COMPANIONS,
    today: todayStr(),
    dateLabel: '服务日期',
    timeText: '',
    companionName: '',
    roomName: '',
    homeId: '',
    roomType: '',
    remarkLen: 0,
    form: {
      primary: '',
      primaryIndex: -1,
      date: '',
      time: '',
      companion: 'pro',
      contactName: '',
      phone: '',
      address: '',
      remark: ''
    }
  },

  onLoad(options) {
    const service = design.getService(options.service) || design.getService('hospital')
    const shortName = (service.primaryLabel || '项目').replace('选择', '')
    const isHospital = service.id === 'hospital'
    const roomName = safeDecode(options.from)

    this.setData({
      bigFont: app.globalData.bigFont,
      service: service,
      roomName: roomName,
      homeId: options.homeId || '',
      roomType: options.room || '',
      steps: ['选择' + shortName, '预约信息', '确认提交'],
      dateLabel: isHospital ? '就诊日期' : '服务日期',
      form: Object.assign({}, this.data.form, {
        primary: '',
        primaryIndex: -1,
        date: defaultDate(),
        companion: service.companion ? 'pro' : ''
      }),
      companionName: service.companion ? '专业陪诊员' : ''
    })

    wx.setNavigationBarTitle({ title: roomName ? (roomName + '改造') : service.name })

    if (options.homeId) this.prefillAddress(options.homeId)
  },

  /** 从房间进来时，把房屋地址和房间名带进表单，少让用户填一遍 */
  prefillAddress(homeId) {
    const self = this
    store.getHomes().then(function (homes) {
      const hit = (homes || []).find(function (h) { return h.id === homeId })
      if (!hit) return

      const patch = {}
      if (!self.data.form.address && hit.address) {
        patch['form.address'] = hit.address
      }
      if (hit.remark && !self.data.form.remark) {
        patch['form.remark'] = String(hit.remark).slice(0, 20)
        patch.remarkLen = patch['form.remark'].length
      }
      if (Object.keys(patch).length > 0) self.setData(patch)
    }).catch(function () {})
  },

  pickPrimary(e) {
    const index = Number(e.currentTarget.dataset.index)
    const option = this.data.service.primaryOptions[index]
    this.setData({
      'form.primaryIndex': index,
      'form.primary': option
    })
  },

  onDate(e) {
    this.setData({ 'form.date': e.detail.value })
  },

  onTime(e) {
    const value = e.detail.value
    const hour = Number(value.split(':')[0])
    const text = (hour < 12 ? '上午 ' : '下午 ') + value
    this.setData({
      'form.time': value,
      timeText: text
    })
  },

  pickCompanion(e) {
    const id = e.currentTarget.dataset.id
    const hit = this.data.companions.find(function (c) {
      return c.id === id
    })
    this.setData({
      'form.companion': id,
      companionName: hit ? hit.name : ''
    })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    const patch = {}
    patch['form.' + field] = value
    if (field === 'remark') patch.remarkLen = value.length
    this.setData(patch)
  },

  prevStep() {
    if (this.data.step > 1) {
      this.setData({ step: this.data.step - 1 })
    }
  },

  nextStep() {
    const step = this.data.step

    if (step === 1) {
      if (this.data.form.primaryIndex < 0) {
        wx.showToast({ title: '请先选择' + this.data.steps[0].replace('选择', ''), icon: 'none' })
        return
      }
      this.setData({ step: 2 })
      return
    }

    if (step === 2) {
      const f = this.data.form
      if (!f.date) return wx.showToast({ title: '请选择日期', icon: 'none' })
      if (!f.time) return wx.showToast({ title: '请选择时间', icon: 'none' })
      if (!f.contactName.trim()) return wx.showToast({ title: '请填写联系人', icon: 'none' })
      if (!/^1\d{10}$/.test(f.phone.trim())) return wx.showToast({ title: '手机号格式不对', icon: 'none' })
      if (!f.address.trim()) return wx.showToast({ title: '请填写服务地址', icon: 'none' })
      this.setData({ step: 3 })
      return
    }

    this.submit()
  },

  submit() {
    if (this.data.submitting) return
    this.setData({ submitting: true })

    const f = this.data.form
    const svc = this.data.service
    const roomName = this.data.roomName

    // 房间和选择项都写进备注，师傅一眼知道改哪里
    const prefix = (roomName ? '【' + roomName + '】' : '') + (f.primary ? '【' + f.primary + '】' : '')

    const order = {
      serviceId: svc.id,
      serviceName: svc.name,
      icon: svc.icon,
      homeId: this.data.homeId,
      roomType: this.data.roomType,
      provider: '安心服务',
      unit: svc.unitDesc || '次',
      price: Number(svc.price) || 0,
      quantity: 1,
      amount: Number(svc.price) || 0,
      forWhom: f.contactName.trim(),
      contactName: f.contactName.trim(),
      phone: f.phone.trim(),
      address: f.address.trim(),
      date: f.date,
      timeSlot: this.data.timeText || f.time,
      remark: prefix + (f.remark || ''),
      familyPhone: '',
      bookedBy: app.globalData.mode === 'family' ? '子女代下单' : '本人下单',
      status: '待接单',
      createdAt: Date.now(),
      records: []
    }

    wx.showLoading({ title: '提交中', mask: true })

    store.addOrder(order).then((res) => {
      wx.hideLoading()
      this.setData({ submitting: false })

      if (!res || res.ok === false) {
        wx.showModal({
          title: '提交失败',
          content: (res && res.message) || '请稍后重试',
          showCancel: false
        })
        return
      }

      const created = res.order || order

      wx.showModal({
        title: '预约成功',
        content: '服务人员会尽快与您电话确认。\n服务项目：' + svc.name,
        confirmText: '查看订单',
        cancelText: '返回',
        success: (r) => {
          if (r.confirm && created.id) {
            wx.redirectTo({ url: '/pages/order-detail/order-detail?id=' + created.id })
          } else {
            wx.switchTab({ url: '/pages/home/home' })
          }
        }
      })
    }).catch((err) => {
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showModal({
        title: '提交失败',
        content: err.message || '网络异常，请稍后重试',
        showCancel: false
      })
    })
  }
})
