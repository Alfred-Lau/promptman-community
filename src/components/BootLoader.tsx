'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * BootLoader —— 品牌启动 loading(纯 CSS/SVG,零依赖)。
 *
 * 背景:生产模式 Electron 从 splash.html loadURL 切到 Next 页面时,HTML 先到而外链
 * CSS 未加载完,会闪一帧"裸 HTML"。此组件在 <body> 最前渲染一个全屏固定遮罩:
 * 样式全部内联(自带 <style>,不依赖外链 CSS/字体/framer-motion),SSR HTML 一到即
 * 显示完整品牌 loading;客户端 mount 后等待 window 'load'(此时外链 CSS 已就绪),
 * 再以 300ms opacity 过渡淡出并卸载。视觉参照官网 BrandLoader:琥珀轨道环 + 青色
 * 反向卫星 + 圆角方块内三行打字动画 + 上游走光标 + PromptMan 品牌字 + 三圆点 +
 * 滑动高光进度条,深色底 #0f0f12 带圆点网格。
 */

const BOOT_CSS = String.raw`
.pmb-root{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#0f0f12;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,"PingFang SC","Microsoft YaHei",sans-serif;-webkit-user-select:none;user-select:none;cursor:default}
.pmb-root *{box-sizing:border-box}
html,body{margin:0;padding:0;background:#0f0f12}
.pmb-grid{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(rgba(255,255,255,0.05) 1px,rgba(255,255,255,0) 1.6px);background-size:26px 26px}
.pmb-glow{position:absolute;width:440px;height:440px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(245,158,11,0.15) 0%,rgba(245,158,11,0.05) 38%,rgba(245,158,11,0) 70%);filter:blur(22px);animation:pmb-breathe 3.6s ease-in-out infinite}
.pmb-col{position:relative;display:flex;flex-direction:column;align-items:center;gap:26px}
.pmb-logo{position:relative;width:112px;height:112px;flex:none}
.pmb-ringbase{position:absolute;inset:0;border-radius:50%;border:1px solid rgba(245,158,11,0.25);opacity:0.5}
.pmb-ring{position:absolute;inset:0;border-radius:50%;opacity:0.9;background:conic-gradient(from 0deg,transparent 0deg,#f59e0b 110deg,transparent 205deg,transparent 360deg);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 1.5px));mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 1.5px));animation:pmb-rot 3.2s linear infinite}
.pmb-satwrap{position:absolute;inset:7px;animation:pmb-rot-rev 5.4s linear infinite}
.pmb-sat{position:absolute;left:calc(50% - 3.5px);top:-3.5px;width:7px;height:7px;border-radius:50%;background:#6ee7f7;box-shadow:0 0 10px rgba(110,231,247,0.95),0 0 22px rgba(110,231,247,0.5)}
.pmb-tile{position:absolute;inset:18px;display:flex;align-items:center;justify-content:center;border-radius:22px;border:1px solid rgba(245,158,11,0.3);background:linear-gradient(160deg,#26262d 0%,#15151a 100%);box-shadow:0 0 0 1px rgba(245,158,11,0.07) inset,0 0 26px rgba(245,158,11,0.12),0 14px 32px rgba(0,0,0,0.35);animation:pmb-float 3.6s ease-in-out infinite}
.pmb-tile::before{content:"";position:absolute;inset:3px;border-radius:19px;background:rgba(245,158,11,0.08)}
.pmb-mark{position:relative;z-index:1;display:block;width:44px;height:44px;overflow:visible}
.pmb-ln{fill:none;stroke:#f59e0b;stroke-width:1.9;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;opacity:0;animation-duration:3.2s;animation-iteration-count:infinite;animation-timing-function:linear}
.pmb-ln1{animation-name:pmb-draw1}
.pmb-ln2{animation-name:pmb-draw2}
.pmb-ln3{animation-name:pmb-draw3}
.pmb-caret{fill:#f59e0b;filter:drop-shadow(0 0 4px rgba(245,158,11,0.85));animation:pmb-caret 3.2s linear infinite}
.pmb-text{display:flex;flex-direction:column;align-items:center;gap:12px}
.pmb-brand{font-size:22px;font-weight:800;letter-spacing:-0.01em;color:#f4f4f5}
.pmb-accent{background:linear-gradient(92deg,#f59e0b 0%,#fbbf24 55%,#f59e0b 100%);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent}
.pmb-status{display:flex;align-items:center;gap:10px;font-family:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;font-size:12px;letter-spacing:0.08em;color:#9b9ba4}
.pmb-dots{display:inline-flex;align-items:center;gap:5px}
.pmb-dot{width:3px;height:3px;border-radius:50%;background:#f59e0b;animation:pmb-hop 1.2s ease-in-out infinite}
.pmb-dot:nth-child(2){animation-delay:0.18s}
.pmb-dot:nth-child(3){animation-delay:0.36s}
.pmb-bar{position:relative;width:140px;height:2px;border-radius:999px;background:rgba(255,255,255,0.08);overflow:hidden}
.pmb-barfill{position:absolute;top:0;bottom:0;left:-46%;width:46%;border-radius:999px;background:linear-gradient(90deg,rgba(245,158,11,0) 0%,#f59e0b 45%,#fde68a 55%,rgba(245,158,11,0) 100%);animation:pmb-sweep 1.6s ease-in-out infinite}
.pmb-exit{opacity:0;transition:opacity 300ms ease;pointer-events:none}
@keyframes pmb-rot{to{transform:rotate(360deg)}}
@keyframes pmb-rot-rev{to{transform:rotate(-360deg)}}
@keyframes pmb-breathe{0%,100%{opacity:0.65;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
@keyframes pmb-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes pmb-hop{0%,100%{opacity:0.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-2px)}}
@keyframes pmb-sweep{0%{left:-46%}100%{left:100%}}
@keyframes pmb-draw1{0%{opacity:0;stroke-dashoffset:1}1%{opacity:1}16%{stroke-dashoffset:0}84%{opacity:1}93%{opacity:0;stroke-dashoffset:0}95%{stroke-dashoffset:1}100%{opacity:0}}
@keyframes pmb-draw2{0%{opacity:0;stroke-dashoffset:1}22%{opacity:1}37%{stroke-dashoffset:0}84%{opacity:1}93%{opacity:0;stroke-dashoffset:0}95%{stroke-dashoffset:1}100%{opacity:0}}
@keyframes pmb-draw3{0%{opacity:0;stroke-dashoffset:1}42%{opacity:1}57%{stroke-dashoffset:0}84%{opacity:1}93%{opacity:0;stroke-dashoffset:0}95%{stroke-dashoffset:1}100%{opacity:0}}
@keyframes pmb-caret{0%{cx:4px;cy:7px;opacity:0.75}1%{opacity:1}16%{cx:20px;cy:7px;opacity:1}17%{opacity:0}17.6%{cx:4px;cy:12px}18.4%{opacity:1}37%{cx:14px;cy:12px;opacity:1}38%{opacity:0}38.6%{cx:4px;cy:17px}39.4%{opacity:1}57%{cx:19px;cy:17px;opacity:1}62%{opacity:0.25}67%{opacity:1}73%{opacity:0.25}78%{opacity:1}84%{opacity:0.7}93%{opacity:0}94%{cx:19px;cy:17px}100%{cx:4px;cy:7px;opacity:0}}
@media (prefers-reduced-motion: reduce){
.pmb-glow{animation:none;opacity:0.5}
.pmb-ring{animation:none}
.pmb-satwrap{animation:none}
.pmb-tile{animation:none}
.pmb-ln{animation:none;opacity:1;stroke-dashoffset:0}
.pmb-caret{animation:none;cx:19px;cy:17px;opacity:0.9}
.pmb-dot{animation:none;opacity:0.9}
.pmb-barfill{animation:none;left:27%}
}
`

/**
 * 三行打字 logo 的几何:line1 从 (4,7) 画到 (20,7),line2 (4,12)→(14,12),
 * line3 (4,17)→(17,17)。pathLength=1 把笔画长度归一化,统一用 dashoffset 做打字。
 */
function LogoMark() {
  return (
    <div className="pmb-logo" aria-hidden="true">
      <div className="pmb-ringbase" />
      <div className="pmb-ring" />
      <div className="pmb-satwrap">
        <span className="pmb-sat" />
      </div>
      <div className="pmb-tile">
        <svg className="pmb-mark" viewBox="0 0 24 24" fill="none">
          <path className="pmb-ln pmb-ln1" pathLength={1} d="M4 7h16" />
          <path className="pmb-ln pmb-ln2" pathLength={1} d="M4 12h10" />
          <path className="pmb-ln pmb-ln3" pathLength={1} d="M4 17h13" />
          <circle className="pmb-caret" cx={4} cy={7} r={2.4} fill="#f59e0b" />
        </svg>
      </div>
    </div>
  )
}

export default function BootLoader() {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let exited = false

    const exit = () => {
      if (exited) return
      exited = true
      if (fallback !== undefined) window.clearTimeout(fallback)
      window.removeEventListener('load', exit)
      el.classList.add('pmb-exit')
      // 300ms opacity 过渡结束后把整棵子树(含内联 <style>)从 DOM 移除
      window.setTimeout(() => setGone(true), 380)
    }

    // 兜底:资源挂起导致 window load 迟迟不来时,最迟 10s 淡出
    const fallback = window.setTimeout(exit, 10000)

    if (document.readyState === 'complete') {
      // load 已触发过(hydration 晚于 load),立即淡出
      exit()
    } else {
      window.addEventListener('load', exit)
    }

    return () => {
      if (fallback !== undefined) window.clearTimeout(fallback)
      window.removeEventListener('load', exit)
    }
  }, [])

  if (gone) return null

  return (
    <div
      ref={rootRef}
      className="pmb-root"
      role="status"
      aria-live="polite"
      aria-label="正在启动"
    >
      <style>{BOOT_CSS}</style>
      <div className="pmb-grid" aria-hidden="true" />
      <div className="pmb-glow" aria-hidden="true" />
      <div className="pmb-col">
        <LogoMark />
        <div className="pmb-text">
          <div className="pmb-brand" aria-hidden="true">
            Prompt<span className="pmb-accent">Man</span>
          </div>
          <div className="pmb-status">
            <span>正在启动…</span>
            <span className="pmb-dots" aria-hidden="true">
              <span className="pmb-dot" />
              <span className="pmb-dot" />
              <span className="pmb-dot" />
            </span>
          </div>
          <div className="pmb-bar" aria-hidden="true">
            <span className="pmb-barfill" />
          </div>
        </div>
      </div>
    </div>
  )
}
