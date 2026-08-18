const WEB3_CONFIG = require('./config');
const WalletManager = require('./wallet');
const EVMAdapter = require('./evm');
const SolanaAdapter = require('./solana');
const Registry = require('./registry');
const Verifier = require('./verifier');
const ProofAdapter = require('./proof');
const ProofFormat = require('./proof-format');

const wallet = new WalletManager(WEB3_CONFIG);

function criarEVM(networkName) {
    const network = WEB3_CONFIG.evm[networkName];

    if (!network) {
        throw new Error(`Rede EVM não encontrada: ${networkName}`);
    }

    return new EVMAdapter(network);
}

function criarSolana() {
    return new SolanaAdapter(WEB3_CONFIG.solana);
}

function listarRedes() {
    return {
        evm: Object.entries(WEB3_CONFIG.evm)
            .filter(([, network]) => network.enabled)
            .map(([id, network]) => ({
                id,
                name: network.name,
                chainId: network.chainId,
                type: 'evm'
            })),

        solana: WEB3_CONFIG.solana.enabled
            ? [{
                id: 'solana',
                name: WEB3_CONFIG.solana.name,
                type: 'solana'
            }]
            : []
    };
}

module.exports = {
    config: WEB3_CONFIG,
    wallet,
    registry: Registry,
    verifier: Verifier,
    criarEVM,
    criarSolana,
    listarRedes,
    ProofAdapter,
    proofFormat: ProofFormat
};
