# 安心养老 · 微信小程序

适老化家居改造 + 居家养老服务预约。同时服务「老人自己用」和「子女代下单」，并带服务人员端（师傅接单履约）。

原生微信小程序，无 npm 依赖，不需要「构建 npm」。

---

## 快速开始

拿到代码后第一步看 **[docs/交付与部署说明.md](docs/交付与部署说明.md)**，里面有从零到跑通的完整步骤。

最短路径：

1. `project.config.json` 填自己的 AppID
2. `utils/config.js` 填云开发环境 ID
3. 用开发者工具导入本目录
4. 部署 7 个云函数
5. 调 `init` 云函数建集合 → 建索引 → 设权限 → 生成演示数据

---

## 页面（13 个）

**5 个 tab**

| 页面 | 说明 |
|---|---|
| `pages/home` | 首页：模式切换、改造入口、进行中订单 |
| `pages/myhome` | 我的家：多套房切换、六个房间入口、缩略图 |
| `pages/help` | 帮我一下：六类服务入口 |
| `pages/heart` | 心语：每日一句、心情记录、健康知识 |
| `pages/profile` | 我的：订单、家人档案、超大字体、师傅入口 |

**子页**

| 页面 | 说明 |
|---|---|
| `pages/room` | 房间详情：实拍图上传、隐患勾选、设计服务 |
| `pages/booking` | 三步预约表单 |
| `pages/orders` | 订单列表（全部 / 进行中 / 已完成） |
| `pages/order-detail` | 订单详情：时间线、凭证、评价 |
| `pages/family` | 家人档案 |
| `pages/staff/home` | 师傅端：工单池 / 我的工单 |
| `pages/staff/detail` | 工单详情：接单、打卡、完成上传凭证 |
| `pages/staff/activate` | 师傅认证（激活码） |

---

## 架构

```
页面
  └─ utils/store.js（工厂）
        ├─ utils/cloud-api.js   → 云函数 → 云数据库 / 云存储   （默认）
        ├─ utils/http-store.js  → 自建后端 HTTP 接口
        └─ utils/local-store.js → wx.setStorageSync（仅调试）
```

改 `utils/config.js` 的 `backend` 一个常量就能换后端，页面代码不用动。
三者方法名与 Promise 契约完全一致，`scripts/check-refs.js` 会校验。

**云函数（7 个）**

`login` 建表与登录 / `home` 多房管理 / `room` 房间资产 / `elder` 家人档案 / `order` 订单状态机 / `staff` 师傅身份 / `init` 环境初始化（上线前删除）

**集合（9 个）**

`users` `homes` `home_access` `elders` `elder_bindings` `orders` `order_logs` `room_assets` `staff`

**订单状态机**：待接单 → 已接单 → 服务中 → 待评价 → 已完成，另有已拒单 / 已取消 / 售后中。
每次流转写 `order_logs`，接单用条件更新做乐观锁防并发。

---

## 适老化

- 正文 ≥30rpx，主按钮 ≥96rpx，点击区 ≥88rpx
- 正文对比度全部 ≥4.5:1（实测值见 `docs/color-palette.md`）
- 「超大字体」开关：字号 ×1.24，全局记忆
- 双模式：我自己用 / 帮家人下单

---

## 测试

```bash
node scripts/check-refs.js     # 结构、require 路径、事件绑定、三方接口一致性
node scripts/test-cloud.js     # 39 项云函数业务流程（内存数据库，不连云端）
node scripts/test-store.js     # 19 项本地数据层
node scripts/test-http.js      # 10 项自建后端适配层
```

改完代码跑一遍，比进真机点快。

---

## 文档

| 文件 | 内容 |
|---|---|
| `docs/交付与部署说明.md` | **接手先看这个**：部署、索引、权限、交接清单 |
| `docs/后端接口契约.md` | 自建后端的 27 个接口定义 |
| `docs/服务端v2设计.md` | 数据模型设计（房屋为一等实体） |
| `docs/服务人员端方案.md` | 工单流转与师傅端范围 |
| `docs/color-palette.md` | 配色与实测对比度 |
| `docs/代码审查与测试报告.md` | 上一轮审查发现的问题与修复 |

---

## 上线前必改

| 项 | 位置 |
|---|---|
| 师傅激活码 | `cloudfunctions/staff/index.js` 的 `STAFF_CODE` |
| 初始化口令 | `cloudfunctions/init/index.js` 的 `INIT_KEY` |
| 删除 init 云函数 | 控制台删除，或至少改口令 |
| 确认非演示模式 | `utils/config.js` 的 `demoMode` 应为 `false` |

---

## 已知限制

- 服务无统一定价，多数订单显示「上门评估后报价」
- 未接微信支付
- 没有订阅消息，用户不知道师傅何时到
- 评价内容未做文本安全审核
- 房间照片上传后可看，但云存储未做防盗链
