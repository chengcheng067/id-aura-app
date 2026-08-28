/**
 * ID Plan · Electron 主进程
 *
 * 关键点：前端使用 createBrowserRouter（依赖 URL 路径），dist 资源为绝对路径 /assets/，
 * 直接用 loadFile 会因 file:// 协议路由 404。因此注册自定义协议 app:// 来托管 dist 静态资源，
 * 并把任意路径回退到 index.html（SPA 回退），这样前端代码与路由零改动即可在桌面运行。
 *
 * 复用 ID Aura 的 Electron 打包思路：独立窗口 + NSIS 安装 + 数据落应用独立目录。
 */
const { app, BrowserWindow, protocol, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// 开发模式判定：默认加载 dist（electron:dev 需要先 npm run build）。
// 若想用 vite dev server 热更新，传 --dev-server 参数。
const useDevServer = process.argv.includes('--dev-server');
const isDev = !app.isPackaged && useDevServer;
const DIST = path.join(__dirname, '..', 'build-dist');
const PROTOCOL = 'app';

// 关键：必须在 app.whenReady() 之前注册 app:// 为 privileged scheme。
// 前端用 <script type="module"> + createBrowserRouter，非 standard 协议下
// Chromium 会以 CORS 拦截 module 脚本导致白屏；注册为 standard+secure+
// corsEnabled+supportFetchAPI 后，module 脚本与 fetch 才能正常执行。
protocol.registerSchemesAsPrivileged([
  {
    scheme: PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

/** 协议处理器：安全地读取 dist 下的文件，未命中则回退 index.html（SPA 回退） */
function registerAppProtocol() {
  protocol.handle(PROTOCOL, (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    // 去掉前导斜杠，得到 dist 内相对路径
    if (pathname.startsWith('/')) pathname = pathname.slice(1);
    if (pathname === '') pathname = 'index.html';

    // 防目录穿越
    const safePath = path.normalize(path.join(DIST, pathname));
    if (!safePath.startsWith(path.normalize(DIST))) {
      return new Response('Forbidden', { status: 403 });
    }

    const mime = mimeFor(path.extname(safePath));
    try {
      if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
        const data = fs.readFileSync(safePath);
        return new Response(data, {
          headers: { 'Content-Type': mime },
        });
      }
    } catch {
      /* 落到下方回退 */
    }
    // SPA 回退：非资源请求一律回 index.html，让前端路由接管
    const index = fs.readFileSync(path.join(DIST, 'index.html'));
    return new Response(index, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  });
}

/** 简易 MIME 映射（够用即可，未覆盖的落到 text/plain） */
function mimeFor(ext) {
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.wasm': 'application/wasm',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

/** 创建主窗口 */
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'ID Plan',
    backgroundColor: '#f5f2ec',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  // 外部链接交给系统浏览器，不劫持加载
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // 开发模式用 vite dev server（热更新）；生产用自定义协议加载 dist
  if (isDev) {
    win.loadURL('http://localhost:5173').catch(() => {
      win.loadURL(`${PROTOCOL}://-/index.html`);
    });
  } else {
    win.loadURL(`${PROTOCOL}://-/index.html`);
  }
  return win;
}

app.setName('ID Plan');

// 单实例锁：避免开多个窗口
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    if (!isDev) Menu.setApplicationMenu(null);
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    // 非 macOS：关闭即退出
    if (process.platform !== 'darwin') app.quit();
  });
}
