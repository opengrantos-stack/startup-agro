const WEB3_CONFIG = {
    enabled: true,

    networks: {
        ethereum: {
            type: 'evm',
            name: 'Ethereum',
            enabled: false
        },

        arbitrum: {
            type: 'evm',
            name: 'Arbitrum',
            enabled: false
        },

        solana: {
            type: 'solana',
            name: 'Solana',
            enabled: false
        }
    }
};

module.exports = WEB3_CONFIG;
