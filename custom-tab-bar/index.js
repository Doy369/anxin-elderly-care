Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/home/home', text: '首页', icon: '🏠' },
      { pagePath: '/pages/myhome/myhome', text: '我的家', icon: '🏡' },
      { pagePath: '/pages/help/help', text: '帮我一下', icon: '🤝' },
      { pagePath: '/pages/heart/heart', text: '心语', icon: '💗' },
      { pagePath: '/pages/profile/profile', text: '我的', icon: '👤' }
    ]
  },

  methods: {
    onTap(e) {
      const index = e.currentTarget.dataset.index
      const path = e.currentTarget.dataset.path
      if (index === this.data.selected) return

      this.setData({ selected: index })
      wx.switchTab({
        url: path,
        fail() {
          wx.reLaunch({ url: path })
        }
      })
    }
  }
})
