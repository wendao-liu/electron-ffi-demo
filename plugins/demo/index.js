const {
    join
} = require('path');
const {
    dynamicallyRequire
} = require(join(process.cwd(), './util/index.js'));


const ffi = dynamicallyRequire('ffi-napi');
let Demo = null;
let random = Math.random();
let dllPath = join(__dirname, './libCbuild2Demo');

const PluginFn = {
    init: (param) => {
        Demo = ffi.Library(dllPath, {
            'init': ['int', ['int']],
            'crash1': ['int', ['int']],
            'exit1': ['int', ['int']],
        })
        let result = Demo.init(10)
        param.data = "初始化成功！" + result;
        return param;
    },
    crash: () => {
        console.log('crash----');
        Demo.crash1(123);
        console.log('----crash');
    },
    exit: () => {
        Demo.exit1(123);
    },
    getValue: (param) => {
        param.data = '获得值' + random;
        return param;
    }
}


module.exports = {
    ...PluginFn,
}