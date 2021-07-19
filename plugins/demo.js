const ffi = require('ffi-napi');
const path = require('path')
let Demo = null;
let random = Math.random();

const PluginFn = {
    init: (param) => {
        console.log('Platform: ', process.platform);
        console.log('Node version: ', process.version);
        console.log('Node dependencies: ', process.versions);
        console.log('Server version: ', process.version);
        Demo = ffi.Library('dll/libtest.dll', {
            'init': ['int', ['int']],
            'crash': ['int', ['int']],
            'exit': ['int', ['int']],
        })
        let result = Demo.init(10)
        param.data = "初始化成功！" + result;
        return param;
    },
    crash: () => {
        Demo.crash(123);
    },
    exit: () => {
        Demo.exit(123);
    },
    getValue: (param) => {
        param.data = '获得值' + random;
        return param;
    }
}


module.exports = {
    ...PluginFn,
}