const WEB3_CONFIG = {
    enabled: true,

    evm: {
        ethereum: {
            name: 'Ethereum',
            chainId: '0x1',
            enabled: false
        },

        arbitrum: {
            name: 'Arbitrum One',
            chainId: '0xa4b1',
            enabled: false
        },

        base: {
            name: 'Base',
            chainId: '0x2105',
            enabled: false
        },

        polygon: {
            name: 'Polygon',
            chainId: '0x89',
            enabled: false
        }
    },

    solana: {
        name: 'Solana',
        enabled: false
    }
};

module.exports = WEB3_CONFIG;
