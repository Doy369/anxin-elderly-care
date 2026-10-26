/**
 * 数据层冒烟测试（本地模式）
 * 不依赖微信环境，用内存 Map 模拟 wx 存储。
 * 用法：node scripts/test-store.js
 */

const path = require('path')
const ROOT = path.resolve(__dirname, '..')

const mem = new Map()
global.wx = {
  getStorageSync(k) {
    return mem.has(k) ? mem.get(k) : ''
  },
  setStorageSync(k, v) {
    mem.set(k, v)
  },
  cloud: null
}

const store = require(path.join(ROOT, 'utils/store.js'))

let pass = 0
let fail = 0

function ok(name, cond, extra) {
  if (cond) {
    pass++
    console.log('  PASS  ' + name)
  } else {
    fail++
    console.log('  FAIL  ' + name + (extra ? '  -> ' + JSON.stringify(extra) : ''))
  }
}

async function main() {
  console.log('backend =', store.backend)
  ok('默认走本地实现', store.backend === 'local')

  // ---- 模式 ----
  ok('默认模式为 elder', store.getMode() === 'elder')
  store.setMode('family')
  ok('模式可写入并读回', store.getMode() === 'family')

  // ---- 订单 ----
  const empty = await store.getOrders()
  ok('初始订单为空数组', Array.isArray(empty) && empty.length === 0)

  const draft = {
    id: 'AX1',
    serviceId: 'S05',
    serviceName: '居家护理照料',
    amount: 136,
    status: '待接单',
    createdAt: Date.now(),
    records: []
  }
  const created = await store.addOrder(draft)
  ok('下单返回 ok', created && created.ok === true, created)

  const list1 = await store.getOrders()
  ok('下单后列表长度为 1', list1.length === 1, list1.length)
  ok('新订单排在首位', list1[0].id === 'AX1')

  const one = await store.getOrderById('AX1')
  ok('可按 ID 查到订单', !!one && one.serviceName === '居家护理照料')

  const missing = await store.getOrderById('NOT_EXIST')
  ok('查不存在的订单返回 null', missing === null)

  const updated = await store.updateOrder('AX1', { status: '已接单' })
  ok('更新状态成功', updated.ok && updated.order.status === '已接单', updated)

  const afterUpdate = await store.getOrderById('AX1')
  ok('状态已持久化', afterUpdate.status === '已接单')

  const withRecords = await store.updateOrder('AX1', {
    records: [{ id: 'R1', time: '2026-10-26 10:00', worker: '陈师傅', content: '已上门' }]
  })
  ok('追加服务记录成功', withRecords.ok && withRecords.order.records.length === 1)

  // ---- 家人档案 ----
  const m1 = await store.addFamilyMember({ name: '王大爷', relation: '父亲', age: 72 })
  ok('新增档案返回 ok', m1.ok && !!m1.member.id, m1)

  const members = await store.getFamilyMembers()
  ok('档案列表长度为 1', members.length === 1)

  const upd = await store.updateFamilyMember(m1.member.id, { note: '有高血压' })
  ok('更新档案成功', upd.ok && upd.member.note === '有高血压')

  const afterUpd = await store.getFamilyMembers()
  ok('档案修改已持久化', afterUpd[0].note === '有高血压')

  const del = await store.removeFamilyMember(m1.member.id)
  ok('删除档案成功', del.ok)
  ok('删除后列表为空', (await store.getFamilyMembers()).length === 0)

  // ---- 删除订单 ----
  await store.removeOrder('AX1')
  ok('删除订单后列表为空', (await store.getOrders()).length === 0)

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败')
  if (fail > 0) process.exit(1)
}

main().catch(function (e) {
  console.error('测试异常：', e)
  process.exit(1)
})
