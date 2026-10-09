import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Web HTML 外壳（Expo Router 官方定制点，dev 与静态导出均生效）。
 *
 * 为什么不用 public/index.html：
 * - `public/index.html` 只被 Expo CLI 的 **SPA（web.output: "single"）** 链路当作模板
 *   （ManifestMiddleware 的 SPA 兜底 + export single），本项目是 `web.output: "static"`，
 *   静态 HTML 由本文件（`+html.tsx`）渲染生成，脚本 `/_expo/static/js/web/*.js` 由渲染器注入；
 *   把模板放进 public/ 会命中 SPA 链路却拿不到 static 渲染的产物 → 白屏。
 *
 * 约束：`<div id="root">` 与 bundle `<script>` 由 Expo 自动注入，切勿手写或删除 {children}。
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#2F3BA2" />

        {/* ⚠️ 不要在此写静态 <title>：Expo Router 的 head 管理器会注入 <title data-rh="true">，
            且它排在前面、浏览器只认第一个 → 静态 title 反而让标签标题变空。
            标题统一用 expo-router/head 的 <Head>（见 src/app/_layout.tsx）声明。 */}
        <meta
          name="keywords"
          content="绕道儿颐伴,颐伴,AI陪伴,中老年陪伴,健康守护,安全守护,养老助手,智能陪伴,绕道儿,Raodaor"
        />
        <meta
          name="description"
          content="绕道儿颐伴 是绕道儿（RaoDaor）生态面向中老年的 AI 暖心陪伴 + 健康安全守护综合生活助手"
        />

        {/* 站点图标与 PWA manifest（资源位于 public/ 下，导出后原样托管） */}
        <link rel="icon" type="image/png" sizes="128x128" href="/images/logo/icon-128x128.png" />
        <link rel="icon" type="image/png" sizes="144x144" href="/images/logo/icon-144x144.png" />
        <link rel="icon" type="image/png" sizes="152x152" href="/images/logo/icon-152x152.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/images/logo/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="256x256" href="/images/logo/icon-256x256.png" />
        <link rel="apple-touch-icon" href="/images/logo/icon-256x256.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* RN Web 全屏布局必需：等价于 #root,body,html{height:100%} body{overflow:hidden} #root{display:flex} */}
        <ScrollViewStyleReset />
      </head>
      <body>
        {children}
        {/* PWA 安装引导（原 public/html.txt 说明的内联脚本迁移至此，仅 beforeinstallprompt 时生效） */}
        <script dangerouslySetInnerHTML={{ __html: PWA_INSTALL_PROMPT }} />
      </body>
    </html>
  );
}

const PWA_INSTALL_PROMPT = `
function loadScript(src){return new Promise((resolve,reject)=>{var script=document.createElement('script');script.src=src;script.async=true;script.onload=function(){return resolve(script)};script.onerror=function(){return reject(new Error(src))};document.head.appendChild(script)})}
document.addEventListener('DOMContentLoaded',function(){
  var deferredPrompt;
  window.addEventListener('beforeinstallprompt',function(event){
    event.preventDefault();
    deferredPrompt=event;
    loadScript('https://cdn.raodaor.com/js/yhw-toast-box.js?v=1').then(function(){
      if(window.YHWToastBox){
        YHWToastBox.show({title:'安装应用',description:'安装『绕道儿颐伴』到桌面，体验更好',icon:'download',primaryText:'安装',
          onPrimaryClick:function(close){ if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt.userChoice.then(function(r){ deferredPrompt=null; }); } close(); },
          onClose:function(){}});
      }
    }).catch(function(err){ if(window.console) console.error('load script error>>',err); });
  });
});
`;
