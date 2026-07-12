# 将右上角菜单并入左侧栏的修改说明

## 文档目标

这份文档专门说明一件事：

- 如何把当前右上角的菜单栏
- 挪到左侧边栏内部
- 并让整体布局看起来更统一

它不是审美建议文档，而是一份偏“操作步骤”的改法说明，方便你直接对照 `index.html` 和 `styles.css` 修改。

涉及的当前代码位置：

- 顶部菜单结构：[index.html](/E:/VScdoe/class/02/kebiao_extracted/index.html:11)
- 左侧栏结构：[index.html](/E:/VScdoe/class/02/kebiao_extracted/index.html:24)
- 顶部菜单样式：[styles.css](/E:/VScdoe/class/02/kebiao_extracted/styles.css:90)
- 左侧栏样式：[styles.css](/E:/VScdoe/class/02/kebiao_extracted/styles.css:231)

---

## 一、为什么适合把右上角菜单放到左侧

当前页面的主要操作分成两类：

- 左侧：课程池 / 学生池 / 添加 / 筛选
- 右上角：教程 / 重置 / 导出 / 设置

这两类其实都属于“工具操作”，只是现在被拆成了两个区域。

把右上角菜单并入左侧的好处：

1. 页面结构更纯粹

- 左边负责工具和操作
- 中间负责课表内容

2. 视觉更集中

- 不再需要一个单独的顶部工具条
- 主区上方会更干净

3. 更符合工作台逻辑

- 用户会更自然地在左边完成操作，在右边查看和编辑课表

---

## 二、推荐的最终结构

建议改成这种结构：

- 左侧栏顶部：工具操作区
- 左侧栏中部：课程池 / 学生池 tab
- 左侧栏底部：课程或学生列表
- 右侧主区：课表主体

也就是说，左侧栏从上到下变成：

1. 菜单操作区
2. 池子切换区
3. 添加按钮区
4. 筛选区
5. 列表区

推荐顺序：

- `导出`
- `重置课表`
- `查看教程`
- `设置`

原因：

- `导出` 是最强主操作，放最前
- `重置` 属于重要但不高频的次操作
- `教程` 和 `设置` 更适合弱化

---

## 三、HTML 结构应该怎么改

## 1. 先删除顶部菜单栏

当前结构大致是：

```html
<div class="top-menu-bar">
    <div class="menu-buttons">
        ...
    </div>
</div>
```

位置参考：

- [index.html](/E:/VScdoe/class/02/kebiao_extracted/index.html:11)

改法：

- 删除整个 `.top-menu-bar`
- 不再保留顶部单独菜单容器

---

## 2. 把按钮插入左侧栏顶部

当前左侧栏起点大致是：

```html
<div class="left-sidebar">
    <div class="subject-pool">
        ...
    </div>
</div>
```

建议改成：

```html
<div class="left-sidebar">
    <div class="sidebar-actions">
        <button id="exportBtn" class="btn primary">导出</button>
        <button id="resetBtn" class="btn secondary">重置课表</button>
        <button id="tutorialBtn" class="btn tertiary">查看教程</button>
        <button id="settingsBtn" class="btn tertiary">设置</button>
    </div>

    <div class="subject-pool">
        ...
    </div>
</div>
```

建议：

- 新建一个 `.sidebar-actions` 容器
- 直接复用原按钮的 `id`
- 这样 JS 绑定基本不用改

这一点很重要：

- 你只是在移动按钮位置
- 不是在替换按钮本身
- 所以尽量不要改按钮 `id`

---

## 四、CSS 应该怎么改

## 1. 顶部栏相关样式可以删除或停用

当前顶部栏样式在：

- [styles.css](/E:/VScdoe/class/02/kebiao_extracted/styles.css:90)

主要包括：

- `.top-menu-bar`
- `.top-menu-bar .menu-buttons`
- 暗色主题下的 `.top-menu-bar` 相关覆盖

改法建议有两种：

### 方案 A：先保留样式，等结构稳定后再删

优点：

- 更稳
- 不容易一次改太多

做法：

- 先把 HTML 中的 `.top-menu-bar` 删除
- CSS 暂时不删，确认页面正常后再清理

### 方案 B：一起清理

做法：

- 删除 `.top-menu-bar`
- 删除 `.top-menu-bar .menu-buttons`
- 删除暗色模式里对应的 `.top-menu-bar` 样式

如果你现在还在反复试样式，建议先用方案 A。

---

## 2. 主容器位置要改

当前布局里，主内容区是给顶部栏和左侧栏“让位”的：

- `.container` 现在有 `top: 64px`
- `.container` 现在有 `left: 256px`

位置参考：

- [styles.css](/E:/VScdoe/class/02/kebiao_extracted/styles.css:116)

当顶部栏删掉后，主容器不需要再从 `64px` 往下挪。

建议修改：

```css
.container {
    top: 0;
    left: 256px;
    right: 0;
    bottom: 0;
    padding: 24px;
}
```

关键点：

- `top` 从 `64px` 改成 `0`
- `left` 保持和左侧栏宽度一致

---

## 3. 左侧栏内部新增菜单区样式

建议新增：

```css
.sidebar-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 16px;
    margin-bottom: 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
```

如果是暗色主题，再补：

```css
body.dark-theme-active .sidebar-actions {
    border-bottom-color: rgba(148, 163, 184, 0.14);
}
```

作用：

- 把菜单区和课程池区明确分层
- 避免所有内容挤在一起

---

## 4. 左侧菜单按钮建议改成整列按钮

现在这些按钮原本是横向排在右上角的，移到左边后，建议改成纵向全宽按钮。

建议样式：

```css
.sidebar-actions .btn {
    width: 100%;
    justify-content: center;
}
```

如果你想更像“左侧工具区”，可以再加：

```css
.sidebar-actions .btn {
    min-height: 36px;
    border-radius: 10px;
}
```

如果想让主次更清楚：

- `导出` 用 `primary`
- `重置课表` 用 `secondary`
- `查看教程`、`设置` 用 `tertiary`

---

## 五、推荐的版式细节

## 1. 左侧栏内部要分成两块

推荐分组：

- 上半部分：`.sidebar-actions`
- 下半部分：`.subject-pool`

这样左侧栏看起来会更像一个完整工具面板。

---

## 2. 菜单区不要太重

既然已经挪到左边，就不要再把它做得像“顶部主导航”。

建议：

- 不要太大按钮
- 不要太重阴影
- 不要每个按钮都像主操作

最好的感觉是：

- `导出` 稍突出
- 其他按钮只是清晰可用

---

## 3. 设置按钮建议去掉 emoji

当前设置按钮里有：

- `⚙️ 设置`

如果你想整体更统一，建议改成：

- `设置`

或者后面统一换成图标体系，不要混用 emoji。

---

## 六、推荐的修改顺序

建议按这个顺序改，最稳：

1. 在左侧栏里新增 `.sidebar-actions`
2. 把四个按钮移进去
3. 删除 HTML 里的 `.top-menu-bar`
4. 把 `.container` 的 `top: 64px` 改成 `top: 0`
5. 给 `.sidebar-actions` 补样式
6. 最后再清理 `.top-menu-bar` 的废弃 CSS

这样改的好处是：

- 每一步都容易验证
- 如果出问题，也容易知道是哪一步导致的

---

## 七、最容易踩的坑

## 1. 改了 HTML，但忘了改 `.container`

结果：

- 顶部会空出一条 64px 的空白

这是最常见的问题。

---

## 2. 左侧栏按钮移进去了，但宽度还是按顶部按钮设计

结果：

- 按钮会显得太短
- 左侧栏顶部像一排“小药丸”，不协调

所以要补：

```css
.sidebar-actions .btn {
    width: 100%;
}
```

---

## 3. 暗色主题忘记补 `.sidebar-actions`

结果：

- 亮色下正常
- 暗色下分隔线或按钮层级不统一

所以如果你保留 dark mode，一定要一起补暗色覆盖。

---

## 4. 删除顶部栏后，忘了清理相关 dark-theme 样式

结果：

- 页面虽然能用
- 但 CSS 里会残留一堆无效样式，后面越改越乱

建议在布局稳定后统一清理。

---

## 八、推荐你采用的最终写法

如果你想改得最自然，我推荐最终做成下面这种逻辑：

- 左侧栏宽度保持 `256px`
- 顶部菜单完全取消
- 左侧栏顶部增加 `.sidebar-actions`
- 主内容区顶到页面最上方
- 左边是完整工具区，右边是完整内容区

这样你的界面结构会从：

- 左边辅助区
- 上面工具条
- 右边内容区

变成：

- 左边工具与资源区
- 右边课表工作区

这个结构会更统一，也更适合继续做美化。

---

## 九、如果你要我直接帮你改

如果后面你不想自己一点点试，可以直接让我按这份文档落地，我会帮你做这几件事：

- 调整 `index.html` 结构
- 补 `sidebar-actions` 样式
- 修改 `.container` 定位
- 清理顶部栏废弃样式
- 顺手补齐 dark-theme 兼容

这样你可以直接看最终效果，而不是自己手动搬结构。
