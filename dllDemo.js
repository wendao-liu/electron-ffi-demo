const ffi = require('ffi-napi');

const platform = process.platform;
var lib = null;

console.log('Platform: ', process.platform);
console.log('Node version: ', process.version);
console.log('Node dependencies: ', process.versions);
console.log('Server version: ', process.version);
if (platform === 'win32') {
    lib = 'dll/libtest.dll';
} else {
    throw new Error('unsupported plateform for lib')
}

var instance = ffi.Library(lib, {
    // int init(int num);
    // int error(int status);
    'init': ['int', ['int']],
    'error': ['int', ['int']],
});
setTimeout(() => {
    instance.error(123)
}, 2000)
console.log(777777777);