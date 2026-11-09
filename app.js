const store = require('./utils/store')
const cfg = require('./utils/config')

App({
  globalData: {
    // 当前使用模式：'elder' 老人自己用 | 'family' 子女代下单
    mode: 'elder',
    // 超大字体（适老化）
    bigFont: false,
    // 后端类型：'local' 或 'cloud'
    backend: store.backend,
    // 登录用户（云端模式才有）
    userInfo: null,
    // 初始化是否失败，失败时首页会提示
    initError: ''
  },

  onLaunch() {
    this.globalData.mode = store.getMode() || 'elder'
    this.globalData.bigFont = store.getBigFont()

    if (cfg.backend === 'cloud') {
      this.initCloud()
    } else if (cfg.backend === 'http') {
      this.initRemote()
    }
  },

  /** 自建后端：不需要 wx.cloud，登录换成 wx.login + 自己的 token */
  initRemote() {
    store.login().then((res) => {
      this.globalData.userInfo = res.user || null
    }).catch((err) => {
      this.globalData.initError = err.message || '登录失败，部分功能不可用'
    })
  },

  initCloud() {
    if (!wx.cloud) {
      this.globalData.initError = '当前微信版本不支持云开发，请升级微信'
      return
    }
    try {
      wx.cloud.init({
        env: cfg.cloudEnv,
        traceUser: true
      })
    } catch (e) {
      this.globalData.initError = '云开发初始化失败，请检查环境 ID'
      return
    }

    // 静默登录并缓存身份
    store.login().then((res) => {
      this.globalData.userInfo = res.user || null
    }).catch(() => {
      this.globalData.initError = '登录失败，部分功能不可用'
    })
  },

  setMode(mode) {
    this.globalData.mode = mode
    store.setMode(mode)
  },

  setBigFont(on) {
    this.globalData.bigFont = on
    store.setBigFont(on)
  }
})
