const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  webContents,
  Tray,
  ipcMain,
} = require('electron');
const path = require('path');
const url = require('url');
const ref = require('ref-napi');
const ffi = require('ffi-napi');
var child_process = require('child_process');
const http = require('http');
let fs = require('fs');
const {
  promises
} = require('stream');
const util = require('util');
var exec = child_process.exec;
var spawn = child_process.spawn;

// 保持一个对于 window 对象的全局引用，如果你不这样做，
// 当 JavaScript 对象被垃圾回收， window 会被自动地关闭
let win, win2;
let tray = null
const exeName = path.basename(process.execPath);
var SQLite3 = {};
let openExec;

// SQLite3 init
function Init() {
  var dbName = process.argv[2] || 'test.sqlite3'
  var sqlite3 = 'void' // `sqlite3` is an "opaque" type, so we don't know its layout
    ,
    sqlite3Ptr = ref.refType(sqlite3),
    sqlite3PtrPtr = ref.refType(sqlite3Ptr),
    sqlite3_exec_callback = 'pointer' // TODO: use ffi.Callback when #76 is implemented
    ,
    stringPtr = ref.refType('string')

  // create FFI'd versions of the libsqlite3 function we're interested in
  SQLite3 = ffi.Library('dll/sqlite3', {
    'sqlite3_libversion': ['string', []],
    'sqlite3_open': ['int', ['string', sqlite3PtrPtr]],
    'sqlite3_close': ['int', [sqlite3Ptr]],
    'sqlite3_changes': ['int', [sqlite3Ptr]],
    'sqlite3_exec': ['int', [sqlite3Ptr, 'string', sqlite3_exec_callback, 'void *', stringPtr]],
  })


  var db = ref.alloc(sqlite3PtrPtr)
  SQLite3.sqlite3_open(dbName, db)
  db = db.deref()

  var callback = ffi.Callback('int', ['void *', 'int', stringPtr, stringPtr], function (tmp, cols, argv, colv) {
    var obj = {}
    for (var i = 0; i < cols; i++) {
      var colName = colv.deref()
      var colData = argv.deref()
      obj[colName] = colData
    }

    // 注册异步IPC通信
    ipcMain.on('SQLite3.sqlite3_exec.async', (event, arg) => {
      event.sender.send('SQLite3.sqlite3_exec.async', JSON.stringify(obj))
    });

    return 0
  })

  var b = new Buffer('test')
  SQLite3.sqlite3_exec.async(db, 'SELECT * FROM foo;', callback, b, null, function (err, ret) {
    // console.log('2----callback', '----callback2');
    if (err) throw err
  })
}

// 获取版本
ipcMain.on('SQLite3.sqlite3_libversion', (event, arg) => {
  event.returnValue = SQLite3.sqlite3_libversion ? SQLite3.sqlite3_libversion() : '0.0.0.';
})


ipcMain.on('asynchronous-message', (event, arg) => {
  console.log(arg) // prints "ping"
  event.reply('asynchronous-reply', 'pong')
})


// 直接走http服务，这样找不到模块
function startServer() {
  // http库是node提供的api，可以直接上node的中文网，直接看到各种api
  let server = http.createServer((req, res) => {

    // 通过你在浏览器输入的网站，利用url.parse进行解析成一个对象，再读取其中pathname的属性
    // 例如你输入http://localhost:8080/index.html，然后url.parse(req.url).pathname返回的值为 "/index.html"
    var pathname = url.parse(req.url).pathname
    console.log('file:' + pathname.substring(1))
    // fs，文件系统，读取文件
    fs.readFile('index.html', (err, data) => {
      if (err) {
        // 错误就返回404状态码
        res.writeHead(404, {
          'Content-Type': 'text/html'
        })
      } else {
        // 成功读取文件
        res.writeHead(200, {
          'Content-Type': 'text/html'
        })
        // 展示文件数据
        res.write(data.toString())
      }
      // 注意，这个end 一定要放在读取文件的内部使用
      console.log(util.inspect(url.parse(req.url)));
      // res.end(util.inspect(url.parse(req.url)))
      res.end()
    })
  })

  server.listen(3000, 'localhost', () => {
    console.log('服务器已经运行，请打开浏览器，输入：http：//127.0.0.1：3000/来访问')
  })
}


function createWindow() {
  Init();
  // startServer();
  nodeStartServer();
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

  if (process.argv.indexOf("--openAsHidden") < 0) {
    //然后加载应用的 index.html。
    win.loadURL(url.format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes: true
    }))
    // win.loadURL('http://localhost:8000')
  } else {
    win.hide();
    win.setSkipTaskbar(true);
  }

  // 当我们点击关闭时触发close事件，我们按照之前的思路在关闭时，隐藏窗口，隐藏任务栏窗口
  // event.preventDefault(); 禁止关闭行为(非常必要，因为我们并不是想要关闭窗口，所以需要禁止默认行为)
  win.on('close', (event) => {
    win.hide();
    win.setSkipTaskbar(true);
    event.preventDefault();
  });
  win.on('show', () => {
    tray.setHighlightMode('always')
  })
  win.on('hide', () => {
    tray.setHighlightMode('never')
  })


  //创建系统通知区菜单
  let iconPath = ''
  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // 测试环境
    iconPath = path.join(app.getAppPath(), './extraResources/icon.ico');
  } else {
    // 正式环境
    // iconPath = path.join(process.resourcesPath, './extraResources/icon.ico');
    iconPath = path.join('./extraResources/icon.ico');
  }

  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([{
      label: '退出',
      click: () => {
        win.destroy()
      }
    }, //我们需要在这里有一个真正的退出（这里直接强制退出）
  ])
  tray.setToolTip('My托盘测试')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => { //我们这里模拟桌面程序点击通知区图标实现打开关闭应用的功能
    win.isVisible() ? win.hide() : win.show()
    win.isVisible() ? win.setSkipTaskbar(false) : win.setSkipTaskbar(true);
  })


  // 当 window 被关闭，这个事件会被触发。
  win.on('closed', () => {
    // 取消引用 window 对象，如果你的应用支持多窗口的话，
    // 通常会把多个 window 对象存放在一个数组里面，
    // 与此同时，你应该删除相应的元素。
    win = null
  })
}

// node 启动服务
function nodeStartServer() {
  openExec = spawn('node', ['./extraResources/server.js']);
  openExec.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  openExec.stderr.on('data', (data) => {
    console.error(`stderr---: ${data}`);
  });

  openExec.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
  });
}

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

// 注册自定义协议
app.setAsDefaultProtocolClient('myApp')
// 监听
app.on('open-url', function (event, url) {
  event.preventDefault()
  console.log(url)
})

app.setLoginItemSettings({
  openAtLogin: true, // Boolean 在登录时启动应用
  openAsHidden: false, // Boolean (可选) mac 表示以隐藏的方式启动应用。~~~~
  // path: updateExe,
  // path: '', String (可选) Windows - 在登录时启动的可执行文件。默认为 process.execPath.
  // args: [] String Windows - 要传递给可执行文件的命令行参数。默认为空数组。注意用引号将路径换行。
  // path: process.execPath,
  path: 'C:\winHaitun\electron-ffi-demo\dist\win-ia32-unpacked\electron-ffi-demo.exe',
  args: [
    '--processStart', `"${'electron-ffi-demo'}"`,
  ]
})

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