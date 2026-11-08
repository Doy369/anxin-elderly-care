const store = require('../../utils/store')
const cfg = require('../../utils/config')

const app = getApp()

const STATUS_DESC = {
  '待接单': '已提交，等待机构接单',
  '已接单': '服务人员已接单，将按时上门服务',
  '服务中': '服务正在进行中，请保持电话畅通',
  '待评价': '服务已完成，等待您的评价',
  '已完成': '服务已完成，感谢您的使用',
  '已取消': '订单已取消',
  '已拒单': '机构无法接单，建议重新预约其他机构',
  '售后中': '售后处理中，客服将在 24 小时内联系您'
}

const FLOW = ['待接单', '已接单', '服务中', '待评价', '已完成']

// 演示模式下，主流程按顺序推进
const NEXT = {
  '待接单': '已接单',
  '已接单': '服务中',
  '服务中': '待评价',
  '待评价': '已完成'
}

function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

function isException(status) {
  return ['已取消', '已拒单', '售后中'].indexOf(status) > -1
}

Page({
  data: {
    order: null,
    bigFont: false,
    statusDesc: '',
    timeline: [],
    canCancel: false,
    demoMode: cfg.demoMode,
    canAdvance: false,
    canRate: false,
    stars: [1, 2, 3, 4, 5],
    rating: 5,
    comment: '',
    submittingRate: false,
    // 无固定价的服务（需上门评估）显示这句，避免出现「¥0」
    feeText: '上门评估后报价'
  },

  onLoad(options) {
    this.orderId = options.id
    this.setData({ bigFont: app.globalData.bigFont, demoMode: cfg.demoMode })
    this.load()
  },

  onShow() {
    this.load()
  },

  load() {
    const self = this
    self.setData({ loading: true })

    store.getOrderById(this.orderId).then(function (order) {
      if (!order) {
        wx.showModal({
          title: '订单不存在',
          content: '该订单可能已被删除',
          showCancel: false,
          success: function () { wx.navigateBack() }
        })
        return
      }
      self.render(order)
    }).catch(function (err) {
      self.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    })
  },

  render(order) {
    const status = order.status
    const exception = isException(status)
    const currentIdx = FLOW.indexOf(status)

    const timeline = FLOW.map(function (label, idx) {
      const t = {
        key: label,
        label: label,
        done: currentIdx > -1 && idx < currentIdx,
        current: currentIdx > -1 && idx === currentIdx,
        last: idx === FLOW.length - 1,
        time: ''
      }
      if (idx === 0) t.time = '下单：' + fmtTime(order.createdAt)
      if (idx === 1 && currentIdx >= 1) t.time = '机构已确认接单'
      if (idx === 2 && currentIdx >= 2) t.time = '服务人员已上门，开始服务'
      if (idx === 3 && currentIdx >= 3) t.time = '服务完成，记录已同步'
      if (idx === 4 && currentIdx >= 4) t.time = '订单已完成'
      return t
    })

    timeline.forEach(function (t) {
      if (exception) {
        t.done = false
        t.current = false
      }
    })

    if (exception) {
      timeline.push({
        key: 'exception',
        label: status,
        done: true,
        current: false,
        last: true,
        time: order.cancelReason || ''
      })
    }

    this.setData({
      order: Object.assign({}, order, {
        statusKey: exception ? 'canceled' : 'serving',
        records: order.records || []
      }),
      statusDesc: STATUS_DESC[status] || '',
      timeline: timeline,
      feeText: (Number(order.amount) || 0) > 0 ? '' : '上门评估后报价',
      canCancel: ['待接单', '已接单'].indexOf(status) > -1,
      canAdvance: cfg.demoMode && !!NEXT[status],
      canRate: status === '待评价',
      rating: order.rating || 5,
      comment: order.comment || ''
    })

    wx.setNavigationBarTitle({ title: order.serviceName || '订单详情' })
  },

  // 演示用：按主流程推进一格（demoMode 关闭后入口不显示）
  advanceStatus() {
    const order = this.data.order
    if (!order) return
    const next = NEXT[order.status]
    if (!next) return

    store.updateOrder(this.orderId, { status: next }).then(() => {
      wx.showToast({ title: '已推进到「' + next + '」', icon: 'none' })
      this.load()
    }).catch((err) => {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    })
  },

  addDemoRecord() {
    const order = this.data.order
    if (!order) return

    const samples = [
      '已上门为老人完成基础生活照料，进食情况良好，精神状态较上次明显好转。',
      '协助完成床铺整理与个人清洁，老人血压 138/86，在正常范围。',
      '完成康复训练 20 分钟，站立平衡能力有改善，建议继续保持每日练习。',
      '已完成家居防滑处理并做承重测试，扶手稳固，老人可在家人陪同下使用。'
    ]

    const records = (order.records || []).concat([{
      id: 'R' + Date.now(),
      time: fmtTime(Date.now()),
      worker: '陈师傅',
      content: samples[(order.records || []).length % samples.length]
    }])

    store.updateOrder(this.orderId, { records: records }).then(() => {
      wx.showToast({ title: '已添加服务记录', icon: 'none' })
      this.load()
    }).catch((err) => {
      wx.showToast({ title: err.message || '添加失败', icon: 'none' })
    })
  },

  cancelOrder() {
    wx.showModal({
      title: '确认取消订单',
      content: '确定要取消这笔服务吗？取消后可以重新预约。',
      confirmText: '确定取消',
      cancelText: '再想想',
      confirmColor: '#5F7168',
      success: (res) => {
        if (!res.confirm) return
        store.updateOrder(this.orderId, {
          status: '已取消',
          cancelReason: '用户主动取消'
        }).then(() => {
          wx.showToast({ title: '订单已取消', icon: 'none' })
          this.load()
        }).catch((err) => {
          wx.showToast({ title: err.message || '取消失败', icon: 'none' })
        })
      }
    })
  },

  /* ---------- 评价 ---------- */
  setRating(e) {
    this.setData({ rating: Number(e.currentTarget.dataset.value) })
  },

  onComment(e) {
    this.setData({ comment: e.detail.value })
  },

  submitRate() {
    if (this.data.submittingRate) return
    this.setData({ submittingRate: true })

    store.rateOrder(this.orderId, this.data.rating, this.data.comment).then((res) => {
      this.setData({ submittingRate: false })
      if (res && res.ok === false) {
        wx.showToast({ title: res.message || '提交失败', icon: 'none' })
        return
      }
      wx.showToast({ title: '感谢您的评价', icon: 'success' })
      this.load()
    }).catch((err) => {
      this.setData({ submittingRate: false })
      wx.showToast({ title: err.message || '提交失败', icon: 'none' })
    })
  },

  contactWorker() {
    const o = this.data.order || {}
    if (!o.staffName) {
      wx.showModal({
        title: '还没有服务人员',
        content: '接单后这里会显示师傅的姓名和电话。',
        showCancel: false
      })
      return
    }
    if (!o.staffPhone) {
      wx.showModal({
        title: o.staffName,
        content: '师傅还没留下联系电话，可以先联系客服转接。',
        showCancel: false
      })
      return
    }
    wx.showModal({
      title: '联系' + o.staffName,
      content: o.staffPhone,
      confirmText: '拨打',
      cancelText: '取消',
      success(res) {
        if (res.confirm) wx.makePhoneCall({ phoneNumber: o.staffPhone })
      }
    })
  }
})
