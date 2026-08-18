async function criarTabelaWeb3(pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS web3_records (
            id SERIAL PRIMARY KEY,
            record_type TEXT NOT NULL,
            record_hash TEXT NOT NULL UNIQUE,
            blockchain TEXT,
            transaction_hash TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    console.log('POSTGRES: tabela web3_records verificada/criada.');
}

async function guardarProva(pool, prova) {
    if (!prova || !prova.hash) {
        throw new Error('Prova Web3 inválida.');
    }

    const resultado = await pool.query(
        `INSERT INTO web3_records
        (record_type, record_hash, blockchain, status)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (record_hash)
        DO UPDATE SET
            blockchain = EXCLUDED.blockchain,
            status = EXCLUDED.status
        RETURNING *`,
        [
            prova.type,
            prova.hash,
            prova.blockchain?.network || null,
            prova.blockchain?.status || 'pending'
        ]
    );

    return resultado.rows[0];
}

module.exports = {
    criarTabelaWeb3,
    guardarProva
};
