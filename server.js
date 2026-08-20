require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

function gerarPinHash(pin) {
    const salt = crypto.randomBytes(16).toString('hex');

    const hash = crypto
        .scryptSync(String(pin), salt, 64)
        .toString('hex');

    return `${salt}:${hash}`;
}

function verificarPin(pin, pinHash) {
    const [salt, hashGuardado] = String(pinHash).split(':');

    if (!salt || !hashGuardado) {
        return false;
    }

    const hashCalculado = crypto
        .scryptSync(String(pin), salt, 64)
        .toString('hex');

    return crypto.timingSafeEqual(
        Buffer.from(hashGuardado, 'hex'),
        Buffer.from(hashCalculado, 'hex')
    );
}

const web3 = require('./web3');
const { criarTabelaWeb3, guardarProva } = require('./web3/storage');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
});



pool.on('error', (error) => {
    console.error('POSTGRES: erro em conexão ociosa:', error.code || '', error.message);
});

let produtosCache = null;


// ==============================
// AUTENTICAÇÃO DO ADMINISTRADOR
// ==============================
// O administrador é uma conta específica.
// O telefone autorizado fica no ambiente do servidor.
// Nunca é enviado pelo utilizador no frontend.

async function verificarAdministradorPorToken(ownerToken) {
    if (!ownerToken) return false;

    const telefoneAdmin =
        String(process.env.STARTUP_AGRO_ADMIN_PHONE || '').trim();

    if (!telefoneAdmin) return false;

    const resultado = await pool.query(
        `SELECT telefone
         FROM utilizadores
         WHERE owner_token = $1`,
        [ownerToken]
    );

    if (resultado.rowCount === 0) {
        return false;
    }

    return String(resultado.rows[0].telefone).trim() === telefoneAdmin;
}

const app = express();
app.use(express.json());
app.use(cors());

// Servir a pasta de uploads publicamente para as imagens aparecerem no site
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Evitar que o navegador mantenha versões antigas das páginas HTML
app.use((req, res, next) => {
    if (req.path === '/' || req.path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const FICHEIRO_DADOS = path.join(__dirname, 'dados.json');
const PASTA_UPLOADS = path.join(__dirname, 'uploads');

// Garantir que a pasta de uploads existe
if (!fs.existsSync(PASTA_UPLOADS)) {
    fs.mkdirSync(PASTA_UPLOADS);
}

// Configuração do Multer para guardar imagens com nomes únicos
const upload = multer({
    storage: multer.memoryStorage()
});

function carregarDados() {
    if (fs.existsSync(FICHEIRO_DADOS)) {
        try {
            return JSON.parse(fs.readFileSync(FICHEIRO_DADOS, 'utf8'));
        } catch (e) {
            console.error("Erro ao ler ficheiro, a usar dados padrão.");
        }
    }
    return {
        produtos: [
            { id: 1, vendedor: "Manuel Carlos", produto: "Milho Verde", preco: "1500 Kz", quantidade: "100", provincia: "Benguela", imagem: "", data: new Date().toISOString() }
        ],
        precisos: [
            { id: 1, comprador: "Mercado Central", produtoDesejado: "Feijão seco", quantidade: "50 sacos", provincia: "Benguela", contacto: "923456789", data: new Date().toISOString() }
        ]
    };
}

function guardarDados(dados) {
    fs.writeFileSync(FICHEIRO_DADOS, JSON.stringify(dados, null, 2), 'utf8');
}


async function criarTabelas() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS produtos (
            id SERIAL PRIMARY KEY,
            vendedor TEXT NOT NULL,
            produto TEXT NOT NULL,
            preco TEXT NOT NULL,
            quantidade TEXT,
            provincia TEXT NOT NULL,
            contacto TEXT,
            imagem TEXT,
            owner_token TEXT,
            data TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS precisos (
            id SERIAL PRIMARY KEY,
            comprador TEXT NOT NULL,
            produto_desejado TEXT NOT NULL,
            quantidade TEXT,
            provincia TEXT NOT NULL,
            contacto TEXT NOT NULL,
            data TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    await pool.query(`
        ALTER TABLE produtos
        ADD COLUMN IF NOT EXISTS owner_token TEXT;

        ALTER TABLE precisos
        ADD COLUMN IF NOT EXISTS owner_token TEXT;

        CREATE TABLE IF NOT EXISTS utilizadores (
            id SERIAL PRIMARY KEY,
            nome TEXT NOT NULL,
            telefone TEXT NOT NULL UNIQUE,
            tipo TEXT NOT NULL,
            pin_hash TEXT NOT NULL,
            owner_token TEXT NOT NULL UNIQUE,
            data TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    console.log('POSTGRES: tabelas verificadas/criadas.');
}


async function migrarDadosExistentes() {
    try {
        const produtosCount = await pool.query('SELECT COUNT(*) FROM produtos');

        if (Number(produtosCount.rows[0].count) === 0 && baseDados.produtos.length > 0) {
            for (const produto of baseDados.produtos) {
                await pool.query(
                    `INSERT INTO produtos
                    (id, vendedor, produto, preco, quantidade, provincia, contacto, imagem, data)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (id) DO NOTHING`,
                    [
                        produto.id,
                        produto.vendedor,
                        produto.produto,
                        produto.preco,
                        produto.quantidade || '1',
                        produto.provincia,
                        produto.contacto || '',
                        produto.imagem || '',
                        produto.data || new Date().toISOString()
                    ]
                );
            }

            await pool.query(`
                SELECT setval(
                    pg_get_serial_sequence('produtos', 'id'),
                    COALESCE((SELECT MAX(id) FROM produtos), 1)
                )
            `);

            console.log('POSTGRES: produtos existentes migrados.');
        }

        const precisosCount = await pool.query('SELECT COUNT(*) FROM precisos');

        if (Number(precisosCount.rows[0].count) === 0 && baseDados.precisos.length > 0) {
            for (const pedido of baseDados.precisos) {
                await pool.query(
                    `INSERT INTO precisos
                    (id, comprador, produto_desejado, quantidade, provincia, contacto, data)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (id) DO NOTHING`,
                    [
                        pedido.id,
                        pedido.comprador,
                        pedido.produtoDesejado,
                        pedido.quantidade || '1',
                        pedido.provincia,
                        pedido.contacto,
                        pedido.data || new Date().toISOString()
                    ]
                );
            }

            await pool.query(`
                SELECT setval(
                    pg_get_serial_sequence('precisos', 'id'),
                    COALESCE((SELECT MAX(id) FROM precisos), 1)
                )
            `);

            console.log('POSTGRES: necessidades existentes migradas.');
        }

    } catch (error) {
        console.error('POSTGRES ERRO NA MIGRAÇÃO:', error.message);
    }
}

let baseDados = carregarDados();

async function inicializarBanco() {
    try {
        await criarTabelas();
        await criarTabelaWeb3(pool);
        await migrarDadosExistentes();
        console.log('POSTGRES: inicialização concluída.');
    } catch (error) {
        console.error('POSTGRES ERRO NA INICIALIZAÇÃO:', error.message);
    }
}

setImmediate(() => {
    inicializarBanco().catch(error => {
        console.error('POSTGRES ERRO NO ARRANQUE:', error.message);
    });
});

app.post('/utilizadores', async (req, res) => {
    try {
        const {
            nome,
            telefone,
            tipo,
            pin,
            ownerToken
        } = req.body;

        const nomeLimpo = String(nome || '').trim();
        const telefoneLimpo = String(telefone || '').trim();
        const tipoLimpo = String(tipo || '').trim().toLowerCase();
        const pinLimpo = String(pin || '').trim();

        if (!nomeLimpo || !telefoneLimpo || !tipoLimpo || !pinLimpo) {
            return res.status(400).json({
                erro: 'Preencha todos os campos obrigatórios.'
            });
        }

        if (!['agricultor', 'comprador'].includes(tipoLimpo)) {
            return res.status(400).json({
                erro: 'Tipo de perfil inválido.'
            });
        }

        if (!/^\d{4,6}$/.test(pinLimpo)) {
            return res.status(400).json({
                erro: 'O PIN deve ter entre 4 e 6 dígitos.'
            });
        }

        const utilizadorExistente = await pool.query(
            `SELECT id FROM utilizadores WHERE telefone = $1`,
            [telefoneLimpo]
        );

        if (utilizadorExistente.rowCount > 0) {
            return res.status(409).json({
                erro: 'Este número de telefone já está registado.'
            });
        }

        const tokenFinal =
            String(ownerToken || '').trim() ||
            crypto.randomUUID();

        const pinHash = gerarPinHash(pinLimpo);

        const resultado = await pool.query(
            `INSERT INTO utilizadores
            (nome, telefone, tipo, pin_hash, owner_token)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, nome, telefone, tipo, owner_token, data`,
            [
                nomeLimpo,
                telefoneLimpo,
                tipoLimpo,
                pinHash,
                tokenFinal
            ]
        );

        res.status(201).json({
            mensagem: 'Conta criada com sucesso!',
            utilizador: resultado.rows[0]
        });

    } catch (error) {
        console.error(
            'ERRO AO CRIAR UTILIZADOR:',
            error.message
        );

        res.status(500).json({
            erro: 'Erro ao criar a conta.'
        });
    }
});


app.post('/login', async (req, res) => {
    try {
        const telefoneLimpo = String(req.body.telefone || '').trim();
        const pinLimpo = String(req.body.pin || '').trim();

        if (!telefoneLimpo || !pinLimpo) {
            return res.status(400).json({
                erro: 'Informe o telefone e o PIN.'
            });
        }

        const resultado = await pool.query(
            `SELECT id, nome, telefone, tipo, pin_hash, owner_token, data
             FROM utilizadores
             WHERE telefone = $1`,
            [telefoneLimpo]
        );

        if (resultado.rowCount === 0) {
            return res.status(401).json({
                erro: 'Telefone ou PIN incorreto.'
            });
        }

        const utilizador = resultado.rows[0];

        if (!verificarPin(pinLimpo, utilizador.pin_hash)) {
            return res.status(401).json({
                erro: 'Telefone ou PIN incorreto.'
            });
        }

        delete utilizador.pin_hash;

        // Reconhecer automaticamente o administrador.
        // Apenas a conta cujo telefone está definido no
        // STARTUP_AGRO_ADMIN_PHONE recebe privilégios administrativos.
        const telefoneAdmin =
            String(process.env.STARTUP_AGRO_ADMIN_PHONE || '').trim();

        utilizador.ehAdministrador =
            telefoneAdmin &&
            String(utilizador.telefone).trim() === telefoneAdmin;

        res.json({
            mensagem: 'Login efetuado com sucesso!',
            utilizador
        });

    } catch (error) {
        console.error(
            'ERRO NO LOGIN:',
            error.message
        );

        res.status(500).json({
            erro: 'Erro ao efetuar login.'
        });
    }
});


app.get('/produtos', async (req, res) => {
    try {
        const { provincia, produto } = req.query;

        // Carregar do PostgreSQL apenas quando o cache estiver vazio.
        if (!produtosCache) {
            const resultado = await pool.query(`
                SELECT id, vendedor, produto, preco, quantidade,
                       provincia, contacto, imagem, data, owner_token
                FROM produtos
                ORDER BY id DESC
            `);

            produtosCache = resultado.rows;
            console.log('PRODUTOS: cache atualizado com', produtosCache.length, 'produtos.');
        }

        let produtos = produtosCache;

        // Aplicar filtros sobre o cache, sem nova consulta ao PostgreSQL.
        if (provincia) {
            produtos = produtos.filter(item =>
                String(item.provincia || '').toLowerCase() ===
                String(provincia).toLowerCase()
            );
        }

        if (produto) {
            const termo = String(produto).toLowerCase();

            produtos = produtos.filter(item =>
                String(item.produto || '').toLowerCase().includes(termo)
            );
        }

        res.json(produtos);

    } catch (error) {
        console.error('ERRO AO CARREGAR PRODUTOS:', error.message);
        res.status(500).json({ erro: 'Erro ao carregar produtos.' });
    }
});


// Rota de cadastro com suporte a imagem
app.post('/cadastrar-produto', upload.single('imagem'), async (req, res) => {
    try {
        const {
            vendedor,
            produto,
            preco,
            quantidade,
            provincia,
            contacto,
            ownerToken
        } = req.body;

        if (!vendedor || !produto || !preco || !provincia || !contacto || !ownerToken) {
            return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
        }

        let caminhoImagem = '';

        if (req.file) {
            const nomeArquivo = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

            const { error: uploadError } = await supabase.storage
                .from('Produtos')
                .upload(nomeArquivo, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                });

            if (uploadError) {
                console.error('ERRO SUPABASE UPLOAD:', uploadError.message);
                return res.status(500).json({
                    erro: 'Erro ao enviar a imagem.'
                });
            }

            const { data: urlData } = supabase.storage
                .from('Produtos')
                .getPublicUrl(nomeArquivo);

            caminhoImagem = urlData.publicUrl;
        }

        const resultado = await pool.query(
            `INSERT INTO produtos
            (vendedor, produto, preco, quantidade, provincia, contacto, imagem, owner_token)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                vendedor,
                produto,
                preco,
                quantidade || '1',
                provincia,
                contacto,
                caminhoImagem,
                ownerToken
            ]
        );

        const produtoGuardado = resultado.rows[0];

        // O produto mudou: invalidar o cache.
        produtosCache = null;

        let provaWeb3 = null;

        try {
            const prova = web3.proofFormat.criarProvaUniversal(
                'produto',
                produtoGuardado,
                {
                    subjectId: produtoGuardado.id,
                    subjectType: 'produto'
                }
            );

            provaWeb3 = await guardarProva(pool, prova);
        } catch (web3Error) {
            console.error(
                'WEB3 ERRO AO CRIAR PROVA:',
                web3Error.message
            );
        }

        res.status(201).json({
            mensagem: 'Produto guardado com sucesso!',
            produto: produtoGuardado,
            web3: provaWeb3
        });

    } catch (error) {
        console.error('ERRO AO GUARDAR PRODUTO:', error.message);
        res.status(500).json({ erro: 'Erro ao guardar o produto.' });
    }
});


app.put('/produtos/:id', upload.single('imagem'), async (req, res) => {
    try {
        const { id } = req.params;

        const {
            vendedor,
            produto,
            preco,
            quantidade,
            provincia,
            contacto,
            ownerToken
        } = req.body;

        const ownerTokenHeader = req.headers['x-owner-token'];
        const ehAdministrador =
            await verificarAdministradorPorToken(ownerTokenHeader);

        if (!vendedor || !produto || !preco || !provincia || !contacto) {
            return res.status(400).json({
                erro: 'Preencha todos os campos obrigatórios.'
            });
        }

        let imagemAtual = null;

        const existente = await pool.query(
            `SELECT imagem FROM produtos WHERE id = $1`,
            [id]
        );

        if (existente.rowCount === 0) {
            return res.status(404).json({
                erro: 'Produto não encontrado.'
            });
        }

        imagemAtual = existente.rows[0].imagem || '';

        // Administrador autenticado pela própria conta.


        // Proprietário precisa comprovar a posse pelo token.
        if (!ehAdministrador) {
            if (!ownerTokenHeader || ownerTokenHeader !== ownerToken) {
                return res.status(403).json({
                    erro: 'Não tens autorização para editar este produto.'
                });
            }

            const proprietario = await pool.query(
                `SELECT id FROM produtos
                 WHERE id = $1 AND owner_token = $2`,
                [id, ownerTokenHeader]
            );

            if (proprietario.rowCount === 0) {
                return res.status(403).json({
                    erro: 'Não tens autorização para editar este produto.'
                });
            }
        }

        let caminhoImagem = imagemAtual;

        if (req.file) {
            const nomeArquivo =
                `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

            const { error: uploadError } = await supabase.storage
                .from('Produtos')
                .upload(nomeArquivo, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                });

            if (uploadError) {
                console.error(
                    'ERRO SUPABASE UPLOAD AO EDITAR:',
                    uploadError.message
                );

                return res.status(500).json({
                    erro: 'Erro ao enviar a nova imagem.'
                });
            }

            const { data: urlData } = supabase.storage
                .from('Produtos')
                .getPublicUrl(nomeArquivo);

            caminhoImagem = urlData.publicUrl;
        }

        const resultado = await pool.query(
            `UPDATE produtos
             SET vendedor = $1,
                 produto = $2,
                 preco = $3,
                 quantidade = $4,
                 provincia = $5,
                 contacto = $6,
                 imagem = $7
             WHERE id = $8
             RETURNING *`,
            [
                vendedor,
                produto,
                preco,
                quantidade || '1',
                provincia,
                contacto,
                caminhoImagem,
                id
            ]
        );

        // O produto mudou: invalidar o cache.
        produtosCache = null;

        res.json({
            mensagem: ehAdministrador
                ? 'Produto atualizado pelo administrador com sucesso!'
                : 'Produto atualizado com sucesso!',
            produto: resultado.rows[0]
        });

    } catch (error) {
        console.error(
            'ERRO AO EDITAR PRODUTO:',
            error.message
        );

        res.status(500).json({
            erro: 'Erro ao editar o produto.'
        });
    }
});

app.delete('/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const ownerToken = req.headers['x-owner-token'];

        const ehAdministrador =
            await verificarAdministradorPorToken(ownerToken);

        // O administrador autenticado pode remover qualquer produto.
        if (ehAdministrador) {
            const resultadoAdmin = await pool.query(
                `DELETE FROM produtos
                 WHERE id = $1
                 RETURNING id`,
                [id]
            );

            if (resultadoAdmin.rowCount === 0) {
                return res.status(404).json({
                    erro: 'Produto não encontrado.'
                });
            }

            // Produto removido: invalidar o cache.
            produtosCache = null;

            return res.json({
                mensagem: 'Produto removido pelo administrador com sucesso.'
            });
        }

        // Caso normal: apenas o proprietário do produto pode removê-lo.
        if (!ownerToken) {
            return res.status(401).json({
                erro: 'Autorização necessária.'
            });
        }

        const resultado = await pool.query(
            `DELETE FROM produtos
             WHERE id = $1 AND owner_token = $2
             RETURNING id`,
            [id, ownerToken]
        );

        if (resultado.rowCount === 0) {
            return res.status(403).json({
                erro: 'Não tens autorização para remover este produto.'
            });
        }

        // Produto removido: invalidar o cache.
        produtosCache = null;

        res.json({
            mensagem: 'Produto removido com sucesso.'
        });

    } catch (error) {
        console.error('ERRO AO REMOVER PRODUTO:', error.message);

        res.status(500).json({
            erro: 'Erro ao remover o produto.'
        });
    }
});

app.get('/web3/provas/:produtoId', async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT * FROM web3_records
             WHERE subject_id = $1 AND subject_type = 'produto'
             ORDER BY created_at DESC`,
            [String(req.params.produtoId)]
        );

        res.json({
            produtoId: req.params.produtoId,
            provas: resultado.rows
        });
    } catch (error) {
        console.error('ERRO AO CONSULTAR PROVA WEB3:', error.message);
        res.status(500).json({ erro: 'Erro ao consultar prova Web3.' });
    }
});

app.get('/precisos', async (req, res) => {
    try {
        let query = 'SELECT id, comprador, produto_desejado AS "produtoDesejado", quantidade, provincia, contacto, data, owner_token FROM precisos';
        const valores = [];
        const filtros = [];

        const { provincia } = req.query;

        if (provincia) {
            valores.push(provincia);
            filtros.push(`provincia ILIKE $${valores.length}`);
        }

        if (filtros.length) {
            query += ' WHERE ' + filtros.join(' AND ');
        }

        query += ' ORDER BY id DESC';

        const resultado = await pool.query(query, valores);

        res.json(resultado.rows);

    } catch (error) {
        console.error('ERRO AO CARREGAR NECESSIDADES:', error.message);
        res.status(500).json({ erro: 'Erro ao carregar necessidades.' });
    }
});

app.delete('/precisos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const ownerToken = req.headers['x-owner-token'];

        const ehAdministrador =
            await verificarAdministradorPorToken(ownerToken);

        // Administrador autenticado pode remover qualquer necessidade.
        if (ehAdministrador) {
            const resultadoAdmin = await pool.query(
                `DELETE FROM precisos
                 WHERE id = $1
                 RETURNING id`,
                [id]
            );

            if (resultadoAdmin.rowCount === 0) {
                return res.status(404).json({
                    erro: 'Necessidade não encontrada.'
                });
            }

            return res.json({
                mensagem: 'Necessidade removida pelo administrador com sucesso.'
            });
        }

        // Normalmente, apenas o próprio comprador pode remover.
        if (!ownerToken) {
            return res.status(401).json({
                erro: 'Autorização necessária.'
            });
        }

        const resultado = await pool.query(
            `DELETE FROM precisos
             WHERE id = $1 AND owner_token = $2
             RETURNING id`,
            [id, ownerToken]
        );

        if (resultado.rowCount === 0) {
            return res.status(403).json({
                erro: 'Não tens autorização para remover esta necessidade.'
            });
        }

        res.json({
            mensagem: 'Necessidade removida com sucesso.'
        });

    } catch (error) {
        console.error(
            'ERRO AO REMOVER NECESSIDADE:',
            error.message
        );

        res.status(500).json({
            erro: 'Erro ao remover a necessidade.'
        });
    }
});

app.put('/precisos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const {
            comprador,
            produtoDesejado,
            quantidade,
            provincia,
            contacto
        } = req.body;

        const ownerToken = req.headers['x-owner-token'];

        const ehAdministrador =
            await verificarAdministradorPorToken(ownerToken);

        if (!comprador || !produtoDesejado || !provincia || !contacto) {
            return res.status(400).json({
                erro: 'Preencha todos os campos obrigatórios.'
            });
        }

        // Administrador autenticado pode editar qualquer necessidade.
        if (ehAdministrador) {
            const resultadoAdmin = await pool.query(
                `UPDATE precisos
                 SET comprador = $1,
                     produto_desejado = $2,
                     quantidade = $3,
                     provincia = $4,
                     contacto = $5
                 WHERE id = $6
                 RETURNING id, comprador,
                           produto_desejado AS "produtoDesejado",
                           quantidade, provincia, contacto,
                           data, owner_token`,
                [
                    comprador,
                    produtoDesejado,
                    quantidade || '1',
                    provincia,
                    contacto,
                    id
                ]
            );

            if (resultadoAdmin.rowCount === 0) {
                return res.status(404).json({
                    erro: 'Necessidade não encontrada.'
                });
            }

            return res.json({
                mensagem: 'Necessidade atualizada pelo administrador com sucesso.',
                pedido: resultadoAdmin.rows[0]
            });
        }

        // Normalmente, apenas o próprio comprador pode editar.
        if (!ownerToken) {
            return res.status(401).json({
                erro: 'Autorização necessária.'
            });
        }

        const resultado = await pool.query(
            `UPDATE precisos
             SET comprador = $1,
                 produto_desejado = $2,
                 quantidade = $3,
                 provincia = $4,
                 contacto = $5
             WHERE id = $6 AND owner_token = $7
             RETURNING id, comprador,
                       produto_desejado AS "produtoDesejado",
                       quantidade, provincia, contacto,
                       data, owner_token`,
            [
                comprador,
                produtoDesejado,
                quantidade || '1',
                provincia,
                contacto,
                id,
                ownerToken
            ]
        );

        if (resultado.rowCount === 0) {
            return res.status(403).json({
                erro: 'Não tens autorização para editar esta necessidade.'
            });
        }

        res.json({
            mensagem: 'Necessidade atualizada com sucesso.',
            pedido: resultado.rows[0]
        });

    } catch (error) {
        console.error(
            'ERRO AO EDITAR NECESSIDADE:',
            error.message
        );

        res.status(500).json({
            erro: 'Erro ao editar a necessidade.'
        });
    }
});

app.post('/precisos', async (req, res) => {
    try {
        const {
            comprador,
            produtoDesejado,
            quantidade,
            provincia,
            contacto,
            ownerToken
        } = req.body;

        if (!comprador || !produtoDesejado || !provincia || !contacto) {
            return res.status(400).json({
                erro: 'Preencha todos os campos obrigatórios.'
            });
        }

        const resultado = await pool.query(
            `INSERT INTO precisos
            (comprador, produto_desejado, quantidade, provincia, contacto, owner_token)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, comprador, produto_desejado AS "produtoDesejado", quantidade, provincia, contacto, data, owner_token`,
            [
                comprador,
                produtoDesejado,
                quantidade || '1',
                provincia,
                contacto,
                ownerToken || null
            ]
        );

        res.status(201).json({
            mensagem: 'Necessidade guardada com sucesso!',
            pedido: resultado.rows[0]
        });

    } catch (error) {
        console.error('ERRO AO GUARDAR NECESSIDADE:', error.message);
        res.status(500).json({
            erro: 'Erro ao guardar a necessidade.'
        });
    }
});


app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor com imagens a correr na porta ${PORT}`);
});
