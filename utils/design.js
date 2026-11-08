/**
 * 静态业务数据：房间、服务场景、预约表单配置
 * 纯前端配置，不依赖后端。后续若改为后台可配，替换本文件的读取来源即可。
 */

// 房间：用于「我的家」六宫格
const ROOMS = [
  { id: 'living', name: '客厅', desc: '安全舒适', icon: '🛋️', tone: '#F1F7EC' },
  { id: 'bedroom', name: '卧室', desc: '安心睡眠', icon: '🛏️', tone: '#F5F2FA' },
  { id: 'kitchen', name: '厨房', desc: '健康饮食', icon: '🍳', tone: '#FDF4EC' },
  { id: 'bathroom', name: '浴室', desc: '防滑安全', icon: '🚿', tone: '#EDF5FB' },
  { id: 'entry', name: '玄关', desc: '出入便利', icon: '🚪', tone: '#F7F3EC' },
  { id: 'balcony', name: '阳台', desc: '享受阳光', icon: '🪴', tone: '#F1F8F1' }
]

// 房间详情：每个房间的适老化改造项
const ROOM_ITEMS = {
  living: ['地面防滑处理', '沙发起身助力扶手', '茶几防撞圆角', '夜间感应地灯'],
  bedroom: ['床边扶手', '起夜感应灯', '床垫软硬调整', '紧急呼叫按钮'],
  kitchen: ['燃气泄漏报警', '台面高度调整', '防烫隔热垫', '常用物品易取收纳'],
  bathroom: ['淋浴区防滑', '马桶侧扶手', '折叠洗澡椅', '浴室紧急拉绳'],
  entry: ['门槛坡道改造', '换鞋凳加高', '入户感应灯', '门锁指纹加装'],
  balcony: ['护栏加固加高', '晾衣杆电动化', '地面防滑', '绿植摆放架']
}

// 服务场景：用于「帮我一下」六宫格
const SERVICES = [
  {
    id: 'hospital',
    name: '陪我去医院',
    desc: '有我陪您 · 更安心',
    icon: '🏥',
    tone: '#EEF6FF',
    // 第 1 步的主选择项
    primaryLabel: '选择医院',
    primaryOptions: ['市第一人民医院', '市中医院', '省人民医院', '社区卫生服务中心'],
    companion: true,
    unitDesc: '次'
  },
  {
    id: 'caregiver',
    name: '找护工',
    desc: '专业照护更贴心',
    icon: '👩‍⚕️',
    tone: '#FDF0F3',
    primaryLabel: '选择照护类型',
    primaryOptions: ['日常照护', '术后护理', '失能照护', '康复陪护'],
    companion: false,
    unitDesc: '天'
  },
  {
    id: 'cook',
    name: '帮我做饭',
    desc: '营养三餐上门',
    icon: '🍲',
    tone: '#FFF4EC',
    primaryLabel: '选择餐次',
    primaryOptions: ['早餐', '午餐', '晚餐', '三餐全包'],
    companion: false,
    unitDesc: '餐'
  },
  {
    id: 'clean',
    name: '家政保洁',
    desc: '干净整洁的家',
    icon: '🧹',
    tone: '#F0F8F2',
    primaryLabel: '选择保洁类型',
    primaryOptions: ['日常保洁', '深度保洁', '开荒保洁', '玻璃清洗'],
    companion: false,
    unitDesc: '次'
  },
  {
    id: 'repair',
    name: '维修服务',
    desc: '快速上门维修',
    icon: '🔧',
    tone: '#F3F5F9',
    primaryLabel: '选择维修项目',
    primaryOptions: ['水电维修', '家电维修', '门窗维修', '墙面修补'],
    companion: false,
    unitDesc: '次'
  },
  {
    id: 'company',
    name: '陪伴服务',
    desc: '陪聊天 · 陪散步',
    icon: '🤝',
    tone: '#FDF3F6',
    primaryLabel: '选择陪伴方式',
    primaryOptions: ['聊天陪伴', '散步陪同', '兴趣陪伴', '读书读报'],
    companion: false,
    unitDesc: '小时'
  }
]

// 陪诊人选项
const COMPANIONS = [
  { id: 'pro', name: '专业陪诊员', desc: '有经验 更安心' },
  { id: 'family', name: '家人陪同', desc: '我已绑定家人' }
]

// 设计服务：不在「帮我一下」六宫格里，从房间详情页进入
const DESIGN = {
  id: 'design',
  name: '设计服务',
  desc: '上门量房 · 出 3D 方案',
  icon: '🎨',
  tone: '#EDF7EE',
  primaryLabel: '选择设计范围',
  primaryOptions: ['客厅设计', '卧室设计', '厨卫设计', '全屋设计'],
  companion: false,
  unitDesc: '次',
  price: 199,
  priceNote: '¥199 抵改造款'
}

// 心语页内容
const HEART_QUOTES = [
  '今天天气不错，记得开窗透透气。',
  '慢慢来，不着急，日子是一天一天过的。',
  '喝一杯温水，对身体好。',
  '想孩子了就打个电话，他们也惦记您。',
  '午后晒晒太阳，心情会好一些。',
  '身体不舒服别硬扛，说出来我们帮您。'
]

const HEART_TOPICS = [
  { id: 't1', title: '睡前泡脚的三个讲究', desc: '水温、时长、加什么', icon: '🦶' },
  { id: 't2', title: '降压药什么时候吃最好', desc: '医生说清楚了', icon: '💊' },
  { id: 't3', title: '家里这些地方最容易摔跤', desc: '一张图检查一遍', icon: '🏠' },
  { id: 't4', title: '一个人吃饭也要好好吃', desc: '简单又营养的搭配', icon: '🥣' }
]

function getService(id) {
  if (id === DESIGN.id) return DESIGN
  return SERVICES.find(function (s) {
    return s.id === id
  }) || null
}

function getRoom(id) {
  return ROOMS.find(function (r) {
    return r.id === id
  }) || null
}

module.exports = {
  ROOMS,
  ROOM_ITEMS,
  SERVICES,
  DESIGN,
  COMPANIONS,
  HEART_QUOTES,
  HEART_TOPICS,
  getService,
  getRoom
}
