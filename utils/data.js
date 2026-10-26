/**
 * 服务目录静态数据
 * 两大类：适老化家居安装改造 / 居家养老服务
 */

const CATEGORIES = [
  { id: 'all', name: '全部', icon: '🏠' },
  { id: 'install', name: '家居安装', icon: '🔧' },
  { id: 'homecare', name: '上门照护', icon: '🩺' },
  { id: 'assist', name: '生活助养', icon: '🧺' }
]

const SERVICES = [
  {
    id: 'S01',
    category: 'install',
    name: '卫生间无障碍改造',
    icon: '🚿',
    price: 2800,
    priceUnit: '起',
    unit: '整套',
    duration: '约 2 天',
    rating: 4.9,
    orderCount: 3268,
    provider: '安心适老改造中心',
    desc: '淋浴区防滑处理、扶手安装、坐便器安全改造，马桶侧与淋浴区双扶手，一站式解决老人洗澡安全问题。',
    tags: ['政府补贴可申请', '含上门测量', '90天质保'],
    includes: ['现场测量与方案设计', '防滑地垫与墙面处理', 'L 型安全扶手 2 套', '折叠安全座椅 1 张'],
    process: ['电话预约测量', '师傅上门评估', '确认方案报价', '上门施工安装', '验收并讲解使用']
  },
  {
    id: 'S02',
    category: 'install',
    name: '床边扶手与起身助力',
    icon: '🛏️',
    price: 480,
    priceUnit: '起',
    unit: '套',
    duration: '当天',
    rating: 4.8,
    orderCount: 5120,
    provider: '安心适老改造中心',
    desc: '免打孔落地扶手，稳固不晃，帮助老人床边起身、如厕移步，有效预防跌倒。',
    tags: ['免打孔', '承重300斤', '当天安装'],
    includes: ['落地式扶手 1 个', '底座防滑垫', '安装与承重检测'],
    process: ['在线预约', '师傅上门安装', '现场承重测试', '使用培训']
  },
  {
    id: 'S03',
    category: 'install',
    name: '全屋防滑改造',
    icon: '🧱',
    price: 1200,
    priceUnit: '起',
    unit: '100㎡',
    duration: '约 3 天',
    rating: 4.7,
    orderCount: 1893,
    provider: '安心适老改造中心',
    desc: '针对厨房、阳台、卫生间等易滑区域整体处理，防滑等级达 R11，雨天也不打滑。',
    tags: ['免费上门评估', '防滑R11', '质保2年'],
    includes: ['全屋地面动线评估', '防滑材料施工', '边角收边处理', '完工清洁'],
    process: ['预约评估', '出具防滑方案', '确认报价', '分区施工', '整体验收']
  },
  {
    id: 'S04',
    category: 'install',
    name: '紧急呼叫与安全监测',
    icon: '🆘',
    price: 890,
    priceUnit: '套',
    unit: '套',
    duration: '当天',
    rating: 4.9,
    orderCount: 2741,
    provider: '安心智护科技',
    desc: '一键呼叫装置 + 卫生间毫米波跌倒监测，异常自动通知子女手机，老人独处更放心。',
    tags: ['跌倒自动报警', '子女手机接收', '免流量卡'],
    includes: ['床头一键呼叫器', '卫生间跌倒传感器', '子女端接收小程序配置', '使用培训'],
    process: ['预约上门', '设备安装调试', '子女手机绑定', '演示使用']
  },
  {
    id: 'S05',
    category: 'homecare',
    name: '居家护理照料',
    icon: '🩺',
    price: 68,
    priceUnit: '起',
    unit: '小时',
    duration: '按小时',
    rating: 4.8,
    orderCount: 8642,
    provider: '安心护理站',
    desc: '持证护理员上门，提供生活照料、协助进食、翻身拍背等基础护理服务。',
    tags: ['持证护理员', '可开发票', '不满意免单'],
    includes: ['生活照料', '进食协助', '翻身拍背', '护理记录回传'],
    process: ['选择服务时长', '选择上门时间', '匹配护理员', '服务后评价']
  },
  {
    id: 'S06',
    category: 'homecare',
    name: '康复训练与理疗',
    icon: '💪',
    price: 120,
    priceUnit: '起',
    unit: '次',
    duration: '60分钟',
    rating: 4.7,
    orderCount: 4157,
    provider: '安心康复中心',
    desc: '康复治疗师上门做中风后遗症、骨关节术后、跌倒后康复训练，配套居家训练计划。',
    tags: ['康复师持证', '居家训练计划', '疗程可套餐'],
    includes: ['康复评估', '关节活动训练', '平衡能力训练', '居家训练方案'],
    process: ['提交病历资料', '预约评估', '制定康复计划', '按次上门训练']
  },
  {
    id: 'S07',
    category: 'homecare',
    name: '陪诊陪跑代办',
    icon: '🚗',
    price: 150,
    priceUnit: '起',
    unit: '半天',
    duration: '4小时',
    rating: 4.6,
    orderCount: 3021,
    provider: '安心陪诊服务',
    desc: '陪同老人就医、取药、缴费，帮忙记医嘱和用药说明，子女远程也能了解诊疗情况。',
    tags: ['全程陪同', '医嘱整理', '行程同步家人'],
    includes: ['医院陪同挂号', '排队候诊协助', '医嘱与用药记录', '检查结果取回'],
    process: ['选择医院与日期', '上传就诊信息', '接单确认', '服务当天同步家人']
  },
  {
    id: 'S08',
    category: 'assist',
    name: '上门助洁助浴',
    icon: '🧼',
    price: 45,
    priceUnit: '起',
    unit: '小时',
    duration: '按小时',
    rating: 4.7,
    orderCount: 5380,
    provider: '安心家政',
    desc: '擦洗地面、清洗油烟机、协助洗澡擦身，擦玻璃等日常做不到的重活交给专业师傅。',
    tags: ['自带工具', '师傅经过培训', '返工免费'],
    includes: ['全屋地面擦洗', '浴室深度清洁', '协助安全洗浴', '厨房重油污清理'],
    process: ['选择日期时段', '确认服务内容', '师傅上门', '完成后确认验收']
  },
  {
    id: 'S09',
    category: 'assist',
    name: '老年助餐与送餐',
    icon: '🍲',
    price: 18,
    priceUnit: '起',
    unit: '餐',
    duration: '每日三餐',
    rating: 4.6,
    orderCount: 7415,
    provider: '安心长者食堂',
    desc: '少油少盐、软烂易嚼，按老年人营养标准配餐，可长期每日定时送餐到家。',
    tags: ['少油少盐', '软烂易嚼', '每日定时送'],
    includes: ['营养师搭配餐食', '少盐少油', '定时送达', '每周菜单公示'],
    process: ['选择送餐地址', '选择餐次', '备注忌口', '每日定时送达']
  },
  {
    id: 'S10',
    category: 'assist',
    name: '助浴上门洗浴',
    icon: '🚿',
    price: 98,
    priceUnit: '起',
    unit: '次',
    duration: '90分钟',
    rating: 4.8,
    orderCount: 2964,
    provider: '安心家政',
    desc: '专业助浴师带移动洗澡椅上门，全程陪同完成擦洗，避免老人独自洗澡跌倒。',
    tags: ['专业助浴师', '移动洗澡椅', '女性优先可选'],
    includes: ['移动洗澡椅', '全身擦洗', '洗浴用品', '浴室防滑检测'],
    process: ['预约日期时段', '确认性别偏好', '助浴师上门', '洗后防滑复查']
  },
  {
    id: 'S11',
    category: 'assist',
    name: '陪聊与精神慰藉',
    icon: '💬',
    price: 60,
    priceUnit: '起',
    unit: '小时',
    duration: '按小时',
    rating: 4.9,
    orderCount: 1873,
    provider: '安心志愿队',
    desc: '持证心理咨询师上门聊天陪伴，缓解孤独情绪，家人可预约定期关怀。',
    tags: ['持证咨询师', '定期关怀', '独居老人优先'],
    includes: ['倾听陪伴', '兴趣活动组织', '情绪状态记录', '异常情况反馈'],
    process: ['预约时段', '匹配咨询师', '上门陪伴', '情绪记录反馈家人']
  },
  {
    id: 'S12',
    category: 'assist',
    name: '适老手机使用教学',
    icon: '📱',
    price: 0,
    priceUnit: '',
    unit: '次',
    duration: '60分钟',
    rating: 4.8,
    orderCount: 4392,
    provider: '安心数字课堂',
    desc: '上门手把手教老人用智能手机：视频通话、挂号、扫码、防止诈骗，完全免费公益服务。',
    tags: ['免费公益', '手把手教', '防诈骗讲解'],
    includes: ['常用功能教学', '视频通话设置', '医院挂号教学', '防诈骗识别课'],
    process: ['预约上门时间', '一对一手把手教学', '现场演练', '赠送大字操作卡']
  }
]

const TIME_SLOTS = [
  '09:00 - 11:00',
  '11:00 - 13:00',
  '13:00 - 15:00',
  '15:00 - 17:00',
  '17:00 - 19:00'
]

const ORDER_STATUS = {
  PENDING: '待接单',
  ACCEPTED: '已接单',
  SERVING: '服务中',
  DONE: '已完成',
  CANCELED: '已取消'
}

module.exports = {
  CATEGORIES,
  SERVICES,
  TIME_SLOTS,
  ORDER_STATUS,
  getServiceById(id) {
    return SERVICES.find(function (s) {
      return s.id === id
    }) || null
  },
  getServicesByCategory(catId) {
    if (catId === 'all') return SERVICES.slice()
    return SERVICES.filter(function (s) {
      return s.category === catId
    })
  }
}
