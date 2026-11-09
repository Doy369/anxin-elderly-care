/**
 * 自建后端适配层测试
 *
 * 不连真实服务器，用假的 wx 对象验证 http-store 的行为：
 *   1. 没配 apiBase 时明确报错，而不是静默返回空数据
 *   2. 正常请求能拿到数据、token 会被带上
 *   3. 401 会清掉本地 token 并要求重新登录
 *
 * 用法：node scripts/test-http.js
 */

const path = require('path')

const cfg = require(path.join(__dirname, '..', 'utils', 'config.js'))

let calls = []
let respond = function () {}

global.wx = {
  getStorageSync: function (k) {
    return store[k] === undefined ? '' : store[k]
  },
  setStorageSync: function (k, v) { store[k] = v },
  removeStorageSync: function (k) { delete store[k] },
  login: function (opts) { opts.success({ code: 'MOCK_CODE' }) },
  request: function (opts) {
    calls.push({ url: opts.url, data: opts.data, header: opts.header })
    respond(opts)
  }
}

const store = {}
const http = require(path.join(__dirname, '..', 'utils', 'http-store.js'))

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

async function main() {
  console.log('== 1. 未配置后端地址 ==')
  cfg.apiBase = ''
  calls = []
  respond = function () { throw new Error('不该发起请求') }

  let err = null
  await http.login().catch(function (e) { err = e })
  check('明确报错而不是静默返回', !!err && /未配置后端地址/.test(err.message), err && err.message)
  check('没有发起任何请求', calls.length === 0, calls.length)

  console.log('\n== 2. 正常登录与取数据 ==')
  cfg.apiBase = 'https://api.example.com/'
  calls = []
  respond = function (opts) {
    if (opts.url.indexOf('/auth') > -1) {
      opts.success({ statusCode: 200, data: { ok: true, token: 'TOKEN_1', user: { id: 'u1', nickname: '张奶奶' } } })
    } else if (opts.url.indexOf('/order') > -1) {
      opts.success({ statusCode: 200, data: { ok: true, list: [{ id: 'o1' }, { id: 'o2' }] } })
    }
  }

  const me = await http.login()
  check('登录返回用户', me.user && me.user.nickname === '张奶奶', me)
  check('token 已留存', store[cfg.tokenKey] === 'TOKEN_1', store[cfg.tokenKey])
  check('URL 拼接没有双斜杠', calls[0].url === 'https://api.example.com/auth', calls[0].url)

  const orders = await http.getOrders()
  check('订单列表解析正确', Array.isArray(orders) && orders.length === 2, orders)
  check('后续请求带上了 token', calls[1].header.Authorization === 'Bearer TOKEN_1', calls[1].header)

  console.log('\n== 3. 业务失败 ==')
  calls = []
  respond = function (opts) {
    opts.success({ statusCode: 200, data: { ok: false, message: '手慢了，这单已被接走' } })
  }
  let bizErr = null
  await http.acceptOrder('o1').catch(function (e) { bizErr = e })
  check('ok:false 会被转成 reject', !!bizErr && /已被接走/.test(bizErr.message), bizErr && bizErr.message)

  console.log('\n== 4. 登录过期 ==')
  calls = []
  respond = function (opts) {
    opts.success({ statusCode: 401, data: { ok: false, message: 'token expired' } })
  }
  let authErr = null
  await http.getHomes().catch(function (e) { authErr = e })
  check('401 提示重新登录', !!authErr && /登录已过期/.test(authErr.message), authErr && authErr.message)
  check('本地 token 已清除', !store[cfg.tokenKey], store[cfg.tokenKey])

  console.log('\n== 结果 ==')
  console.log('通过 ' + passed + ' / 失败 ' + failed)
  if (failed > 0) process.exit(1)
}

main().catch(function (e) {
  console.error('\n测试异常中断：', e)
  process.exit(1)
})
