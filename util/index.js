const path = require('path');

function dynamicallyRequire(moduleName) {
    let modulePath = getNodeModulesPath(moduleName);
    let module = require(modulePath);
    return module;
}

function getNodeModulesPath(moduleName) {
    return '../node_modules/' + moduleName;
}

module.exports = {
    dynamicallyRequire,
}