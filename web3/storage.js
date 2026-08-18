async function criarTabelaWeb3(pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS web3_records (
            id SERIAL PRIMARY KEY,
            record_type TEXT NOT NULL,
            record_hash TEXT NOT NULL UNIQUE,
            subject_id TEXT,
            subject_type TEXT,
            blockchain TEXT,
            transaction_hash TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    // Garante as colunas caso a tabela já existisse de uma versão anterior.
    await pool.query(`
        ALTER TABLE web3_records
        ADD COLUMN IF NOT EXISTS subject_id TEXT,
        ADD COLUMN IF NOT EXISTS subject_type TEXT;
    `);

    console.log('POSTGRES: tabela web3_records verificada/criada.');
}

async function guardarProva(pool, prova) {
    if (!prova || !prova.hash) {
        throw new Error('Prova Web3 inválida.');
    }

    const resultado = await pool.query(
        `INSERT INTO web3_records
        (record_type, record_hash, subject_id, subject_type, blockchain, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (record_hash)
        DO UPDATE SET
            subject_id = EXCLUDED.subject_id,
            subject_type = EXCLUDED.subject_type,
            blockchain = EXCLUDED.blockchain,
            status = EXCLUDED.status
        RETURNING *`,
        [
            prova.type,
            prova.hash,
            prova.subject?.id != null ? String(prova.subject.id) : null,
            prova.subject?.type || null,
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
