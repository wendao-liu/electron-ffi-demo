var ffi = require('ffi-napi');
var ref = require('ref-napi');
const path = require('path');
const iconv = require('iconv-lite');
console.log(111);
var ptrOutputByteArray = ref.refType('char');
var ptrOutput = new Buffer.alloc(1000);
// process.env.PATH = `${process.env.PATH}${path.delimiter}${path.resolve(__dirname, './hz/')}`;
// var kernel32 = ffi.Library("kernel32", {
//   'SetDllDirectoryA': ["bool", ["string"]],
//   })

// kernel32.SetDllDirectoryA(path.join(__dirname, './hz/'));

process.chdir('./hz');

var HZS = ffi.Library('HZSiInterface.dll', {
    INIT: ['int', [ptrOutputByteArray]],
    // 'BUSINESS_HANDLE':['int',['string',ref.refType(ref.types.char)]]
});

const callInit = HZS.INIT(ptrOutput);
process.chdir('../');
ptrOutput.type = ref.types.char;
console.log(ptrOutput.deref(), 'buf.deref()');
console.log('callInit', callInit, iconv.decode(ptrOutput, 'gbk'));