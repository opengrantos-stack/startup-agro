const WEB3_CONFIG = require('./config');
const WalletManager = require('./wallet');
const Registry = require('./registry');

const wallet = new WalletManager(WEB3_CONFIG);

module.exports = {
    config: WEB3_CONFIG,
    wallet,
    registry: Registry
};
