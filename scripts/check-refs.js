/**
 * 工程自检：页面完整性 + 模块引用 + 事件绑定 + 样式括号
 *
 * 补的是「编译能过、运行时才炸」这一类问题——比如深层目录里 require 少写一层，
 * 编译阶段不报错，进页面直接白屏。
 *
 * 用法：node scripts/check-refs.js
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
let errors = []
let pages = []

function read(p) {
  return fs.readFileSync(path.join(ROOT, p), 'utf8')
}

function exists(p) {
  return fs.existsSync(path.join(ROOT, p))
}

/* ---------- 1. 页面文件完整性 ---------- */
const app = JSON.parse(read('app.json'))
pages = app.pages

pages.forEach(function (p) {
  ;['.wxml', '.js', '.json', '.wxss'].forEach(function (ext) {
    if (!exists(p + ext)) errors.push('缺少文件：' + p + ext)
  })
})

/* ---------- 2. 模块引用路径必须真实存在 ---------- */
function collectJs(dir, out) {
  fs.readdirSync(path.join(ROOT, dir)).forEach(function (name) {
    const rel = dir + '/' + name
    const stat = fs.statSync(path.join(ROOT, rel))
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'miniprogram_npm') return
      collectJs(rel, out)
    } else if (name.endsWith('.js')) {
      out.push(rel)
    }
  })
  return out
}

const jsFiles = collectJs('pages', [])
  .concat(collectJs('utils', []))
  .concat(collectJs('cloudfunctions', []))
  .concat(['app.js'])

jsFiles.forEach(function (f) {
  const src = read(f)
  const re = /require\('(\.[^']+)'\)/g
  let m
  while ((m = re.exec(src)) !== null) {
    const rel = m[1]
    const target = path.normalize(path.join(path.dirname(f), rel))
    if (!exists(target) && !exists(target + '.js')) {
      errors.push('引用不存在：' + f + ' → ' + rel + '（解析为 ' + target + '）')
    }
  }
})

/* ---------- 3. WXML 里绑定的事件必须在 JS 中有定义 ---------- */
pages.forEach(function (p) {
  if (!exists(p + '.js') || !exists(p + '.wxml')) return
  const js = read(p + '.js')
  const wxml = read(p + '.wxml')
  const bound = new Set()
  const re = /(?:bind|catch)(?::)?[a-zA-Z]+="([a-zA-Z_$][\w$]*)"/g
  let m
  while ((m = re.exec(wxml)) !== null) bound.add(m[1])

  bound.forEach(function (h) {
    const declared = new RegExp('(^|[\\s,{])' + h + '\\s*(\\(|:)').test(js)
    if (!declared) errors.push('未定义的事件处理函数：' + p + ' → ' + h)
  })
})

/* ---------- 4. WXSS 花括号平衡 ---------- */
function collectWxss(dir) {
  let out = []
  fs.readdirSync(path.join(ROOT, dir)).forEach(function (name) {
    const rel = dir + '/' + name
    const stat = fs.statSync(path.join(ROOT, rel))
    if (stat.isDirectory()) out = out.concat(collectWxss(rel))
    else if (name.endsWith('.wxss')) out.push(rel)
  })
  return out
}

collectWxss('pages').concat(['app.wxss', 'custom-tab-bar/index.wxss']).forEach(function (f) {
  if (!exists(f)) return
  const s = read(f)
  const open = (s.match(/\{/g) || []).length
  const close = (s.match(/\}/g) || []).length
  if (open !== close) errors.push('花括号不平衡：' + f + ' ' + open + '/' + close)
})

/* ---------- 5. 云函数目录完整性 ---------- */
if (exists('cloudfunctions')) {
  fs.readdirSync(path.join(ROOT, 'cloudfunctions')).forEach(function (name) {
    const dir = 'cloudfunctions/' + name
    if (!fs.statSync(path.join(ROOT, dir)).isDirectory()) return
    if (!exists(dir + '/index.js')) errors.push('云函数缺 index.js：' + dir)
    if (!exists(dir + '/package.json')) errors.push('云函数缺 package.json：' + dir)
  })
}

/* ---------- 6. 数据层三个实现的方法契约必须一致 ---------- */
try {
  const cloudImpl = require(path.join(ROOT, 'utils/cloud-api.js'))
  const httpImpl = require(path.join(ROOT, 'utils/http-store.js'))
  const localImpl = require(path.join(ROOT, 'utils/local-store.js'))

  function methods(m) {
    return Object.keys(m).filter(function (k) {
      return typeof m[k] === 'function' && k !== 'name'
    })
  }

  const base = methods(cloudImpl)
  const http = methods(httpImpl)
  const loc = methods(localImpl)

  // cloud 是基准：http 必须一模一样，否则切后端会缺方法
  http.filter(function (k) { return base.indexOf(k) === -1 })
    .forEach(function (k) { errors.push('http-store 多出方法：' + k) })
  base.filter(function (k) { return http.indexOf(k) === -1 })
    .forEach(function (k) { errors.push('http-store 缺少方法：' + k) })

  // local 允许少一个 login —— store.js 里有兜底实现
  loc.filter(function (k) { return base.indexOf(k) === -1 && k !== 'login' })
    .forEach(function (k) { errors.push('local-store 多出方法：' + k) })
  base.filter(function (k) { return loc.indexOf(k) === -1 && k !== 'login' })
    .forEach(function (k) { errors.push('local-store 缺少方法：' + k) })
} catch (e) {
  errors.push('数据层实现加载失败：' + e.message)
}

/* ---------- 输出 ---------- */
console.log('页面 ' + pages.length + ' 个 · JS ' + jsFiles.length + ' 个')
if (errors.length === 0) {
  console.log('ALL CHECKS PASSED')
} else {
  console.log('发现 ' + errors.length + ' 个问题：')
  errors.forEach(function (e) { console.log('  - ' + e) })
  process.exit(1)
}
