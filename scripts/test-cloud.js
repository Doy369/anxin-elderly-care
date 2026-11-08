/**
 * 云函数功能测试
 *
 * 做法：用内存数据库模拟 wx-server-sdk，然后直接调云函数的 exports.main，
 * 按真实业务流程跑一遍——下单、抢单、并发接单、打卡、完成、权限校验。
 *
 * 这样不需要真机、不需要连云端，也能验证状态机和权限逻辑。
 *
 * 用法：node scripts/test-cloud.js
 */

const Module = require('module')
const path = require('path')

/* ==================== 内存数据库 ==================== */

const db = (function () {
  const store = {}
  let seq = 0
  let openid = ''

  function clone(o) {
    return o === undefined ? undefined : JSON.parse(JSON.stringify(o))
  }

  function coll(name) {
    if (!store[name]) store[name] = []
    return store[name]
  }

  const command = {
    in: function (arr) { return { __cmd: 'in', value: arr } },
    and: function (arr) { return { __cmd: 'and', value: arr } },
    or: function (arr) { return { __cmd: 'or', value: arr } },
    eq: function (v) { return { __cmd: 'eq', value: v } }
  }

  function matchField(val, cond) {
    if (cond && typeof cond === 'object' && cond.__cmd) {
      if (cond.__cmd === 'in') return cond.value.indexOf(val) > -1
      if (cond.__cmd === 'eq') return val === cond.value
      return false
    }
    return val === cond
  }

  function matchDoc(doc, q) {
    if (q && q.__cmd === 'or') return q.value.some(function (s) { return matchDoc(doc, s) })
    if (q && q.__cmd === 'and') return q.value.every(function (s) { return matchDoc(doc, s) })
    return Object.keys(q).every(function (k) { return matchField(doc[k], q[k]) })
  }

  function Query(name, q) {
    this.name = name
    this.q = q
    this._limit = 100
    this._order = null
  }

  Query.prototype.orderBy = function (f, d) {
    this._order = { f: f, d: d }
    return this
  }

  Query.prototype.limit = function (n) {
    this._limit = n
    return this
  }

  Query.prototype._rows = function () {
    const self = this
    let rows = coll(self.name).filter(function (d) { return matchDoc(d, self.q) })
    if (this._order) {
      const f = this._order.f
      const desc = this._order.d === 'desc'
      rows = rows.slice().sort(function (a, b) {
        if (a[f] === b[f]) return 0
        return (a[f] > b[f] ? 1 : -1) * (desc ? -1 : 1)
      })
    }
    return rows
  }

  Query.prototype.get = function () {
    return Promise.resolve({
      data: this._rows().slice(0, this._limit).map(clone)
    })
  }

  Query.prototype.count = function () {
    return Promise.resolve({ total: this._rows().length })
  }

  Query.prototype.update = function (opts) {
    const rows = this._rows()
    rows.forEach(function (d) { Object.assign(d, clone(opts.data)) })
    return Promise.resolve({ stats: { updated: rows.length } })
  }

  Query.prototype.remove = function () {
    const ids = this._rows().map(function (d) { return d._id })
    store[this.name] = coll(this.name).filter(function (d) { return ids.indexOf(d._id) === -1 })
    return Promise.resolve({ stats: { removed: ids.length } })
  }

  function DocRef(name, id) {
    this.name = name
    this.id = id
  }

  DocRef.prototype._row = function () {
    const self = this
    return coll(self.name).find(function (d) { return d._id === self.id })
  }

  DocRef.prototype.get = function () {
    const r = this._row()
    if (!r) return Promise.reject(new Error('document not exist'))
    return Promise.resolve({ data: clone(r) })
  }

  DocRef.prototype.update = function (opts) {
    const r = this._row()
    if (!r) return Promise.resolve({ stats: { updated: 0 } })
    Object.assign(r, clone(opts.data))
    return Promise.resolve({ stats: { updated: 1 } })
  }

  DocRef.prototype.remove = function () {
    const self = this
    const before = coll(self.name).length
    store[self.name] = coll(self.name).filter(function (d) { return d._id !== self.id })
    return Promise.resolve({ stats: { removed: before - store[self.name].length } })
  }

  return {
    command: command,
    database: function () {
      return {
        command: command,
        collection: function (name) {
          return {
            add: function (opts) {
              const id = 'id_' + (++seq)
              coll(name).push(Object.assign({ _id: id }, clone(opts.data)))
              return Promise.resolve({ _id: id })
            },
            where: function (q) { return new Query(name, q) },
            doc: function (id) { return new DocRef(name, id) },
            count: function () { return Promise.resolve({ total: coll(name).length }) }
          }
        }
      }
    },
    _store: store,
    _setOpenid: function (v) { openid = v },
    _getOpenid: function () { return openid },
    _seed: function (name, doc) {
      const id = 'seed_' + (++seq)
      coll(name).push(Object.assign({ _id: id }, clone(doc)))
      return id
    },
    _reset: function () {
      Object.keys(store).forEach(function (k) { delete store[k] })
      seq = 0
    }
  }
})()

/* ==================== 拦截 wx-server-sdk ==================== */

const sdk = {
  DYNAMIC_CURRENT_ENV: 'mock-env',
  init: function () {},
  database: function () { return db.database() },
  getWXContext: function () { return { OPENID: db._getOpenid(), APPID: 'wxtest' } },
  deleteFile: function () { return Promise.resolve({}) }
}

const originalLoad = Module._load
Module._load = function (request) {
  if (request === 'wx-server-sdk') return sdk
  return originalLoad.apply(this, arguments)
}

const orderFn = require(path.join(__dirname, '..', 'cloudfunctions', 'order', 'index.js'))
const roomFn = require(path.join(__dirname, '..', 'cloudfunctions', 'room', 'index.js'))
const staffFn = require(path.join(__dirname, '..', 'cloudfunctions', 'staff', 'index.js'))
const homeFn = require(path.join(__dirname, '..', 'cloudfunctions', 'home', 'index.js'))

/* ==================== 断言工具 ==================== */

let passed = 0
let failed = 0

function check(name, cond, extra) {
  if (cond) {
    passed++
    console.log('  PASS  ' + name)
  } else {
    failed++
    console.log('  FAIL  ' + name + (extra ? '  →  ' + JSON.stringify(extra) : ''))
  }
}

async function as(openid, fn) {
  db._setOpenid(openid)
  return fn()
}

/* ==================== 场景 ==================== */

async function main() {
  console.log('== 准备数据 ==')
  db._reset()

  const userA = db._seed('users', { openid: 'openid_a', nickname: '张奶奶', role: 'user' })
  const userB = db._seed('users', { openid: 'openid_b', nickname: '师傅乙', role: 'staff' })
  const userC = db._seed('users', { openid: 'openid_c', nickname: '师傅丙', role: 'staff' })
  const homeId = db._seed('homes', { name: '爸妈家', address: '幸福路 18 号 3 单元 402', ownerUserId: userA, createdAt: 1 })

  db._seed('home_access', { homeId: homeId, userId: userA, role: 'owner', status: 'active' })
  db._seed('staff', { userId: userB, name: '李师傅', phone: '13900000001', status: 'active' })
  db._seed('staff', { userId: userC, name: '王师傅', phone: '13900000002', status: 'active' })
  db._seed('room_assets', {
    homeId: homeId,
    roomType: 'bathroom',
    photoFileID: 'cloud://bath.jpg',
    checks: [0, 1],
    photoUpdatedAt: 1000
  })

  console.log('  用户 3 个 / 房屋 1 套 / 师傅 2 位 / 浴室照片 1 张')

  /* ---- 1. 下单 ---- */
  console.log('\n== 1. 用户下单 ==')
  const created = await as('openid_a', function () {
    return orderFn.main({
      action: 'create',
      order: {
        serviceId: 'hospital',
        serviceName: '陪我去医院',
        homeId: homeId,
        roomType: 'bathroom',
        contactName: '张奶奶',
        phone: '13800001111',
        address: '幸福路 18 号 3 单元 402',
        date: '2026-11-01',
        timeSlot: '上午 09:00',
        remark: '【浴室】防滑'
      }
    })
  })
  check('下单成功', created.ok === true, created)

  const orderId = created.order && created.order.id
  check('订单带 homeId', !!(created.order && created.order.homeId === homeId), created.order && created.order.homeId)
  check('初始 staffId 为空字符串', created.order && created.order.staffId === '', created.order && created.order.staffId)
  check('初始状态为待接单', created.order && created.order.status === '待接单')

  /* ---- 2. 师傅看工单池 ---- */
  console.log('\n== 2. 工单池 ==')
  const poolB = await as('openid_b', function () { return orderFn.main({ action: 'pool' }) })
  check('师傅能看到 1 单', poolB.ok && poolB.list.length === 1, poolB)
  check('接单前手机号打码', poolB.list[0].phone === '138****1111', poolB.list[0].phone)

  const poolA = await as('openid_a', function () { return orderFn.main({ action: 'pool' }) })
  check('普通用户不能用工单池', poolA.ok === false, poolA)

  /* ---- 3. 并发接单 ---- */
  console.log('\n== 3. 并发接单（乐观锁）==')
  const results = await Promise.all([
    as('openid_b', function () { return orderFn.main({ action: 'accept', id: orderId }) }),
    as('openid_c', function () { return orderFn.main({ action: 'accept', id: orderId }) })
  ])
  const wins = results.filter(function (r) { return r.ok })
  const loses = results.filter(function (r) { return !r.ok })
  check('两人同时接单只成功一个', wins.length === 1 && loses.length === 1, results)
  check('失败提示为已被接走', loses.length === 1 && /接走/.test(loses[0].message), loses[0])

  const winner = wins[0] ? (results.indexOf(wins[0]) === 0 ? 'openid_b' : 'openid_c') : ''
  const loser = winner === 'openid_b' ? 'openid_c' : 'openid_b'
  console.log('  赢家：' + winner + '，输家：' + loser)

  /* ---- 4. 订单状态 ---- */
  console.log('\n== 4. 接单后的状态 ==')
  const afterAccept = await as('openid_a', function () { return orderFn.main({ action: 'detail', id: orderId }) })
  check('用户看到状态变为已接单', !!(afterAccept.order && afterAccept.order.status === '已接单'), afterAccept)
  check('用户能看到师傅姓名', !!(afterAccept.order && afterAccept.order.staffName), afterAccept.order && afterAccept.order.staffName)
  check('用户能看到完整手机号', !!(afterAccept.order && afterAccept.order.phone === '13800001111'), afterAccept.order && afterAccept.order.phone)

  const loserArrive = await as(loser, function () { return orderFn.main({ action: 'arrive', id: orderId }) })
  check('没接到单的师傅不能打卡', loserArrive.ok === false, loserArrive)

  /* ---- 5. 房屋照片权限 ---- */
  console.log('\n== 5. 师傅查看房屋照片 ==')
  const roomWinner = await as(winner, function () { return roomFn.main({ action: 'list', homeId: homeId }) })
  check('接单师傅能看房屋照片', roomWinner.ok === true, roomWinner)
  check('能读到浴室照片', !!(roomWinner.assets && roomWinner.assets.bathroom && roomWinner.assets.bathroom.fileID))

  const roomLoser = await as(loser, function () { return roomFn.main({ action: 'list', homeId: homeId }) })
  check('未接单师傅看不到照片', roomLoser.ok === false, roomLoser)

  const roomOwner = await as('openid_a', function () { return roomFn.main({ action: 'list', homeId: homeId }) })
  check('房屋成员能看照片且不是只读', roomOwner.ok === true && roomOwner.readOnly === false, roomOwner)

  const staffWrite = await as(winner, function () {
    return roomFn.main({ action: 'setChecks', homeId: homeId, roomType: 'bathroom', checks: [0] })
  })
  check('师傅不能修改勾选（只读）', staffWrite.ok === false, staffWrite)

  /* ---- 6. 打卡 ---- */
  console.log('\n== 6. 打卡 ==')
  const arrive = await as(winner, function () { return orderFn.main({ action: 'arrive', id: orderId }) })
  check('接单师傅打卡成功', arrive.ok === true, arrive)

  const doubleArrive = await as(winner, function () { return orderFn.main({ action: 'arrive', id: orderId }) })
  check('重复打卡被拒绝', doubleArrive.ok === false, doubleArrive)

  /* ---- 7. 完成服务 ---- */
  console.log('\n== 7. 完成服务 ==')
  const finishNoPhoto = await as(winner, function () {
    return orderFn.main({ action: 'finish', id: orderId, media: [], note: '已完成' })
  })
  check('没有照片不能完成', finishNoPhoto.ok === false, finishNoPhoto)

  const finish = await as(winner, function () {
    return orderFn.main({ action: 'finish', id: orderId, media: ['cloud://work1.jpg'], note: '装好扶手两根' })
  })
  check('有照片可以完成', finish.ok === true, finish)

  const finalDetail = await as('openid_a', function () { return orderFn.main({ action: 'detail', id: orderId }) })
  check('状态变为待评价', finalDetail.order.status === '待评价', finalDetail.order && finalDetail.order.status)
  check('凭证已保存', finalDetail.order.media && finalDetail.order.media.length === 1)
  check('服务记录已写入', finalDetail.order.records && finalDetail.order.records.length === 1)
  check('日志记录了 4 次流转', finalDetail.logs.length === 4, finalDetail.logs.length)

  /* ---- 8. 待评价之后 ---- */
  console.log('\n== 8. 评价并完成 ==')
  const rateBad = await as('openid_a', function () {
    return orderFn.main({ action: 'rate', id: orderId, rating: 9, comment: '好' })
  })
  check('评分会被夹到 1-5', rateBad.ok === true && rateBad.rating === 5, rateBad)

  const finalAfterRate = await as('openid_a', function () {
    return orderFn.main({ action: 'detail', id: orderId })
  })
  check('评价后状态变为已完成', finalAfterRate.order.status === '已完成', finalAfterRate.order && finalAfterRate.order.status)
  check('评价内容已保存', finalAfterRate.order.rating === 5 && finalAfterRate.order.comment === '好', finalAfterRate.order && finalAfterRate.order.rating)

  const rateAgain = await as('openid_a', function () {
    return orderFn.main({ action: 'rate', id: orderId, rating: 3 })
  })
  check('已完成不能再评价', rateAgain.ok === false, rateAgain)

  const fakeStaff = await as('openid_a', function () {
    return orderFn.main({ action: 'transition', id: orderId, to: '售后中' })
  })
  check('普通用户可申请售后', fakeStaff.ok === true, fakeStaff)

  /* ---- 9. 房屋与角色 ---- */
  console.log('\n== 9. 房屋与师傅身份 ==')
  const homes = await as('openid_a', function () { return homeFn.main({ action: 'list' }) })
  check('能列出自己的房屋', homes.ok && homes.list.length === 1, homes)

  const homesB = await as('openid_b', function () { return homeFn.main({ action: 'list' }) })
  check('师傅首次进入自动建一套默认房', homesB.ok && homesB.list.length === 1, homesB)

  const meStaff = await as(winner, function () { return staffFn.main({ action: 'me' }) })
  check('师傅能查到自己的身份', meStaff.ok && meStaff.staff && meStaff.staff.name, meStaff)

  const meUser = await as('openid_a', function () { return staffFn.main({ action: 'me' }) })
  check('普通用户没有师傅身份', meUser.ok && meUser.staff === null, meUser)

  const badCode = await as('openid_a', function () {
    return staffFn.main({ action: 'activate', data: { code: 'WRONG', name: '张三', phone: '13700001111' } })
  })
  check('错误激活码被拒绝', badCode.ok === false, badCode)

  /* ---- 10. 越权尝试 ---- */
  console.log('\n== 10. 越权尝试 ==')
  const second = await as('openid_a', function () {
    return orderFn.main({
      action: 'create',
      order: {
        serviceId: 'repair', serviceName: '维修服务', homeId: homeId,
        contactName: '张奶奶', phone: '13800001111', address: '幸福路 18 号',
        date: '2026-11-02', timeSlot: '上午 10:00'
      }
    })
  })
  const secondId = second.order.id

  const fakeAccept = await as('openid_a', function () {
    return orderFn.main({ action: 'transition', id: secondId, to: '已接单', actor: 'staff' })
  })
  check('普通用户不能假冒 staff 推进订单', fakeAccept.ok === false, fakeAccept)

  const otherStaff = await as(loser, function () {
    return orderFn.main({ action: 'transition', id: secondId, to: '已接单', actor: 'staff' })
  })
  check('未接单的师傅不能直接流转', otherStaff.ok === false, otherStaff)

  const staffCancel = await as(winner, function () {
    return orderFn.main({ action: 'transition', id: secondId, to: '已取消', actor: 'staff' })
  })
  check('师傅无权取消用户订单', staffCancel.ok === false, staffCancel)

  /* ---- 汇总 ---- */
  console.log('\n== 结果 ==')
  console.log('通过 ' + passed + ' / 失败 ' + failed)
  if (failed > 0) process.exit(1)
}

main().catch(function (e) {
  console.error('\n测试异常中断：', e)
  process.exit(1)
})
