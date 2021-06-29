const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  webContents,
  Tray,
} = require('electron')
const path = require('path')
const url = require('url')


// 保持一个对于 window 对象的全局引用，如果你不这样做，
// 当 JavaScript 对象被垃圾回收， window 会被自动地关闭
let win, win2;
const exeName = path.basename(process.execPath);

function createWindow() {
  // 创建浏览器窗口。
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  })

  const template = [{
      role: 'window',
      submenu: [{
          role: 'minimize'
        },
        {
          role: 'close'
        }
      ]
    },
    {
      role: 'help',
      submenu: [{
        label: 'Learn More',
        click() {
          require('electron').shell.openExternal('https://electron.atom.io')
        }
      }]
    },
    {
      label: 'Reload',
      accelerator: 'CmdOrCtrl+R',
      click: () => {
        win.webContents.reload();
      },
    },
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  // 打开开发者工具。
  win.webContents.openDevTools();

  console.log(1);

  if (process.argv.indexOf("--openAsHidden") < 0) {
    //然后加载应用的 index.html。
    win.loadURL(url.format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes: true
    }))
  }

  // 当 window 被关闭，这个事件会被触发。
  win.on('closed', () => {
    // 取消引用 window 对象，如果你的应用支持多窗口的话，
    // 通常会把多个 window 对象存放在一个数组里面，
    // 与此同时，你应该删除相应的元素。
    win = null
  })
}

let tray = null
app.whenReady().then(() => {
  tray = new Tray('./ico.ico')
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Item1', type: 'radio' },
    { label: 'Item2', type: 'radio' },
    { label: 'Item3', type: 'radio', checked: true },
    { label: 'Item4', type: 'radio' }
  ])
  tray.setToolTip('This is my application.')
  tray.setContextMenu(contextMenu)
})

// Electron 会在初始化后并准备
// 创建浏览器窗口时，调用这个函数。
// 部分 API 在 ready 事件触发后才能使用。
app.on('ready', createWindow)

// 当全部窗口关闭时退出。
app.on('window-all-closed', () => {
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== 'darwin') {
    app.quit();
  }
})

app.on('activate', () => {
  // 在macOS上，当单击dock图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  if (win === null) {
    createWindow()
  }
})

// try {
//   require('electron-reloader')(module);
// } catch (_) {}

// 注册自定义协议
app.setAsDefaultProtocolClient('myApp')
// 监听
app.on('open-url', function (event, url) {
  event.preventDefault()
  console.log(url)
})



// app.setLoginItemSettings({
//   openAtLogin: true, // Boolean 在登录时启动应用
//   openAsHidden: false, // Boolean (可选) mac 表示以隐藏的方式启动应用。~~~~
//   // path: updateExe,
//   // path: '', String (可选) Windows - 在登录时启动的可执行文件。默认为 process.execPath.
//   // args: [] String Windows - 要传递给可执行文件的命令行参数。默认为空数组。注意用引号将路径换行。
//   // path: process.execPath,
//   path: 'C:\winHaitun\electron-ffi-demo\dist\win-ia32-unpacked\electron-ffi-demo.exe',
//   args: [
//     '--processStart', `"${'electron-ffi-demo'}"`,
//   ]
// })


//应用是否打包
if (app.isPackaged) {
  //设置开机启动
  app.setLoginItemSettings({
    openAtLogin: true,
    args: ["--openAsHidden"],
  });

  //获取是否开机启动
  const {
    openAtLogin
  } = app.getLoginItemSettings({
    args: ["--openAsHidden"],
  });
  return openAtLogin;
}