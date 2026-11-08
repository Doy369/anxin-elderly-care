const app = getApp()
const design = require('../../utils/design')

const MOODS = [
  { id: 'good', emoji: '😊', name: '很好' },
  { id: 'ok', emoji: '🙂', name: '还行' },
  { id: 'meh', emoji: '😐', name: '一般' },
  { id: 'bad', emoji: '😔', name: '不太好' }
]

function todayKey() {
  const d = new Date()
  return 'mood_' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()
}

function todayText() {
  const d = new Date()
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + week
}

Page({
  data: {
    bigFont: false,
    quote: '',
    todayText: '',
    moods: MOODS,
    mood: '',
    topics: design.HEART_TOPICS
  },

  onLoad() {
    // 按天轮换一句，同一天进来保持一致
    const idx = new Date().getDate() % design.HEART_QUOTES.length
    this.setData({
      quote: design.HEART_QUOTES[idx],
      todayText: todayText()
    })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    this.setData({
      bigFont: app.globalData.bigFont,
      mood: wx.getStorageSync(todayKey()) || ''
    })
  },

  pickMood(e) {
    const id = e.currentTarget.dataset.id
    wx.setStorageSync(todayKey(), id)
    this.setData({ mood: id })
  },

  openTopic() {
    wx.showToast({ title: '内容正在整理中', icon: 'none' })
  },

  talkToUs() {
    wx.showModal({
      title: '想聊点什么？',
      content: '可以拨打 400-800-1234，也可以让家人帮您在小程序里留言。',
      confirmText: '拨打电话',
      cancelText: '知道了',
      success(res) {
        if (res.confirm) wx.makePhoneCall({ phoneNumber: '4008001234' })
      }
    })
  }
})
