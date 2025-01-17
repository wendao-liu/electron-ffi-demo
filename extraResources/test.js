/**
 * Module dependencies.
 */

var fs = require('fs'),
    ref = require('ref-napi'),
    ffi = require('ffi-napi')

function Init(io) {
    // 3秒模拟崩溃
    setInterval(()=> {
        let err = Buffer.from('定时3秒报错');
        console.log(err.toString(),'----err');
        new Error(err);
    },3000);
    /**
     * The filename of the sqlite3 database to use.
     */

    var dbName = process.argv[2] || 'test.sqlite3'

    /**
     * "ref" types that the sqlite3 functions will use.
     */

    var sqlite3 = 'void' // `sqlite3` is an "opaque" type, so we don't know its layout
        ,
        sqlite3Ptr = ref.refType(sqlite3),
        sqlite3PtrPtr = ref.refType(sqlite3Ptr),
        sqlite3_exec_callback = 'pointer' // TODO: use ffi.Callback when #76 is implemented
        ,
        stringPtr = ref.refType('string')

    // create FFI'd versions of the libsqlite3 function we're interested in
    var SQLite3 = ffi.Library('dll/sqlite3', {
        'sqlite3_libversion': ['string', []],
        'sqlite3_open': ['int', ['string', sqlite3PtrPtr]],
        'sqlite3_close': ['int', [sqlite3Ptr]],
        'sqlite3_changes': ['int', [sqlite3Ptr]],
        'sqlite3_exec': ['int', [sqlite3Ptr, 'string', sqlite3_exec_callback, 'void *', stringPtr]],
    })

    // print out the "libsqlite3" version number
    console.log('Using libsqlite3 version %j...', SQLite3.sqlite3_libversion())

    // create a storage area for the db pointer SQLite3 gives us
    var db = ref.alloc(sqlite3PtrPtr)

    // open the database object
    console.log('Opening %j...', dbName)
    SQLite3.sqlite3_open(dbName, db)

    // we don't care about the `sqlite **`, but rather the `sqlite *` that it's
    // pointing to, so we must deref()
    db = db.deref()

    // execute a couple SQL queries to create the table "foo" and ensure it's empty
    console.log('Creating and/or clearing foo table...')
    SQLite3.sqlite3_exec(db, 'CREATE TABLE foo (bar VARCHAR);', null, null, null)
    SQLite3.sqlite3_exec(db, 'DELETE FROM foo;', null, null, null)

    // execute a few INSERT queries into the "foo" table
    console.log('Inserting bar 5 times...')
    for (var i = 0; i < 5; i++) {
        SQLite3.sqlite3_exec(db, 'INSERT INTO foo VALUES(\'baz' + i + '\');', null, null, null)
    }

    // we can also run queries asynchronously on the thread pool. this is good for
    // when you expect a query to take a long time. when running SELECT queries, you
    // pass a callback function that gets invoked for each record found. since we're
    // running asynchronously, you pass a second callback function that will be
    // invoked when the query has completed.
    var rowCount = 0
    var callback = ffi.Callback('int', ['void *', 'int', stringPtr, stringPtr], function (tmp, cols, argv, colv) {
        var obj = {}
        for (var i = 0; i < cols; i++) {
            var colName = colv.deref()
            var colData = argv.deref()
            obj[colName] = colData
        }
        io.emit('chat message', {
            'init': `Row: ${JSON.stringify(obj)}`
        });
        // console.log('Row: %j', obj)
        rowCount++
        return 0
    })
    var b = Buffer.from('test')
    SQLite3.sqlite3_exec.async(db, 'SELECT * FROM foo;', callback, b, null, function (err, ret) {
        // console.log('2----callback', '----callback2');
        if (err) throw err
    })
}

module.exports = Init;  