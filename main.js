const cluster = require('cluster');
const http = require('http');
const fs = require('fs');
const numCPUs = require('os').cpus().length;

console.log(cluster.isMaster, '---cluster.isPrimary');
if (cluster.isMaster) {
  var pluginDir = fs.readdirSync("./plugin").map(p => (p.split('.')[0]));
  console.log(pluginDir);
  let keyPid = {}

  // 衍生工作进程
  pluginDir.forEach((name) => {
    cluster.fork({
      name,
    });
  })

  cluster.on('exit', (worker, code, signal) => {
    // console.log(`worker ${worker.process.pid} died`);
  });

  for (const id in cluster.workers) {
    cluster.workers[id].on('message', async (result) => {
      // pid 和 plugin name 对应关系
      const {
        name,
        pid
      } = result || {};
      if (name && pid) {
        keyPid[pid] = name
      }
      console.log(result, 'client-result');
    });
  }



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
  // const http = require('http');
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
  var SQLite3 = null;
  let openExec;
  let IPCEvent = [];
  let SOCKETEvent = [];

  function errTip(plugin, param) {
    if (!plugin) {
      return false;
    }
    return true;
  }
  const PluginFn = {
    idCard: {
      status: false,
      getVersion: (arg) => {
        let param = {
          ...arg,
        }
        if (!errTip(SQLite3, param)) {
          param.data = {
            err: '请先初始化'
          }
          return param;
        }
        param.data = SQLite3.sqlite3_libversion ? SQLite3.sqlite3_libversion() : '0.0.0';
        // sendMessage(param);
        return param;
      },
      init: ({
        pluginName,
        fn
      }) => {
        let param = {
          pluginName,
          fn
        }
        if (!PluginFn[pluginName][fn].status) {
          PluginFn[pluginName][fn].status = true
        } else {
          param.data = {
            err: '请不要重复初始化'
          }
          // sendMessage({
          //   ...param,
          //   data: {
          //     err: '请不要重复初始化'
          //   }
          // });
          return param;
        }
        var sqlite3 = 'void' // `sqlite3` is an "opaque" pluginName, so we don't know its layout
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

        param.data = '初始化成功！'

        // sendMessage(param);
        return param;
      },
      execSync: (arg) => {
        let param = {
          ...arg,
        }
        if (!errTip(SQLite3, param)) {
          param.data = {
            err: '请先初始化'
          }
          return param;
        }
        var dbName = process.argv[2] || 'test.sqlite3'
        var sqlite3 = 'void' // `sqlite3` is an "opaque" pluginName, so we don't know its layout
          ,
          sqlite3Ptr = ref.refType(sqlite3),
          sqlite3PtrPtr = ref.refType(sqlite3Ptr),
          stringPtr = ref.refType('string')
        var db = ref.alloc(sqlite3PtrPtr)
        SQLite3.sqlite3_open(dbName, db)
        db = db.deref();
        var b = Buffer.from('test');

        return new Promise((reslove, reject) => {
          var callback = ffi.Callback('int', ['void *', 'int', stringPtr, stringPtr], cb)
          let args = [];

          function cb(tmp, cols, argv, colv) {
            var obj = {}
            for (var i = 0; i < cols; i++) {
              var colName = colv.deref();
              var colData = argv.deref();
              obj[colName] = colData;
            }
            // sendMessage(param);
            args.push(obj)
            return 0
          }
          SQLite3.sqlite3_exec.async(db, 'SELECT * FROM foo;', callback, b, null, function (err, ret) {
            console.log(err, ret, 'err, ret');
            let param = {
              ...arg,
              data: args
            }
            reslove(param)
            if (err) throw err
          })
        })
      },
      eventIpc: (type) => {
        const param = {
          type: 'ipc'
        }
        IPCEvent.sender.send('CSMessage', param)
      },
      eventSocket: (type) => {
        const param = {
          type: 'socket'
        }
        SOCKETEvent.forEach((s) => {
          s.emit('CSMessage', param)
        })
      }
    }
  }


  function startServer() {

    return server();
  }

  function server() {
    // 直接走http服务
    (function () {
      let app = require('express')();
      var http = require('http').Server(app);
      var io = require('socket.io')(http)
      var bodyParser = require('body-parser');

      io.on('connection', socket => {
        console.log('链接成功');
        // 响应用户发送的信息
        SOCKETEvent.push(socket)
        socket.on('CSMessage', function (arg) {
          const {
            pluginName,
            fn
          } = arg || {};
          if (fn) {
            PluginFn[pluginName][fn](arg);
            // eval(`${fn}(${JSON.stringify(arg)})`);
          } else {
            io.emit('CSMessage', {
              pluginName: null,
              data: 'pong'
            })
          }
        })
      });

      app.use(bodyParser.json())
      app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, './index.html'))
      })


      function fnhandle(arg) {
        const {
          pluginName,
          fn
        } = arg || {};
        if (fn) {
          return PluginFn[pluginName][fn](arg);
        }
      }

      app.post('/CSMessage', async (req, res) => {
        const params = req.body;
        // const result = await fnhandle(params);
        const result = {};
        const workers = Object.values(cluster.workers);
        workers.forEach(worker => {
          if (keyPid[worker.pid]) {
            worker.send(params)
          }
        });

        res.send({
          ...result
        })
      })

      // 建立通信
      ipcMain.on('CSMessage', async (event, arg) => {
        // IPCEvent.push(event);
        IPCEvent = event;
        const {
          pluginName,
          fn
        } = arg || {};
        if (fn) {
          const workers = Object.values(cluster.workers);
          workers.forEach(worker => {
            worker.send(arg)
          });
          event.returnValue = {};
          // let res = await PluginFn[pluginName][fn](arg);
          // event.returnValue = res;
        }
      })

      http.listen(8080, 'localhost', () => {
        console.log('服务器已经运行，请打开浏览器，输入：http://127.0.0.1:8080/来访问')
      })
    })()
  }


  // SQLite3 init
  function sendMessage(param) {
    // IPCEvent.forEach((ipc) => {
    //   ipc.sender.send('CSMessage', param)
    // })
    IPCEvent.sender.send('CSMessage', param)
    SOCKETEvent.forEach((s) => {
      s.emit('CSMessage', param)
    })
  }

  function createWindow() {
    // nodeStartServer();
    startServer();
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

  // // 注册自定义协议
  // app.setAsDefaultProtocolClient('myApp')


  // 注册自定义协议
  function setDefaultProtocol(agreement) {
    // const agreement = 'electron-playground-code' // 自定义协议名
    let isSet = false // 是否注册成功

    app.removeAsDefaultProtocolClient(agreement) // 每次运行都删除自定义协议 然后再重新注册
    // 开发模式下在window运行需要做兼容
    if (process.env.NODE_ENV === 'development' && process.platform === 'win32') {
      // 设置electron.exe 和 app的路径
      isSet = app.setAsDefaultProtocolClient(agreement, process.execPath, [
        path.resolve(process.argv[1]),
      ])
    } else {
      isSet = app.setAsDefaultProtocolClient(agreement)
    }
    console.log('是否注册成功', isSet)
  }
  setDefaultProtocol('electron');


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
} else {
  // 工作进程可以共享任何 TCP 连接
  // 在本示例中，其是 HTTP 服务器
  require('./plugins.js');
  console.log(`client-Worker ${process.pid} started`);
}