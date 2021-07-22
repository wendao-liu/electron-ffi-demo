const {
    join
} = require('path');
const {
    dynamicallyRequire
} = require(join(process.cwd(), '/util/index.js'));
const ffi = dynamicallyRequire('ffi-napi');
const ref = dynamicallyRequire('ref-napi');
let SQLite3 = null;
let IPCEvent = [];
let dllPath = join(__dirname, './sqlite3');

function errTip(plugin, param) {
    if (!plugin) {
        return false;
    }
    return true;
}



const PluginFn = {
    status: false,
    getVersion: (param) => {
        // throw Error('error')
        if (!errTip(SQLite3, param)) {
            param.data = {
                err: '请先初始化'
            }
            return param;
        }
        param.data = SQLite3.sqlite3_libversion ? SQLite3.sqlite3_libversion() : '0.0.0';
        return param;
    },
    init: (param) => {
        if (!PluginFn.status) {
            PluginFn.status = true
        } else {
            param.data = {
                err: '请不要重复初始化'
            }
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
        SQLite3 = ffi.Library(dllPath, {
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
    execSync: (param) => {
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
    async: (param) => {
        process.send({
            type: 'async',
            data: param,
        });
    },
}

module.exports = {
    ...PluginFn,
}