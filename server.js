const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

pool.query('SELECT NOW()')
    .then(result => console.log('POSTGRES OK:', result.rows[0].now))
    .catch(error => console.error('POSTGRES ERRO:', error.message));



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
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, PASTA_UPLOADS),
    filename: (req, file, cb) => {
        const unico = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unico + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

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

    console.log('POSTGRES: tabelas verificadas/criadas.');
}

criarTabelas().catch(error => {
    console.error('POSTGRES ERRO AO CRIAR TABELAS:', error.message);
});

let baseDados = carregarDados();

app.get('/produtos', async (req, res) => {
    try {
        let query = 'SELECT * FROM produtos';
        const valores = [];
        const filtros = [];

        const { provincia, produto } = req.query;

        if (provincia) {
            valores.push(provincia);
            filtros.push(`provincia ILIKE $${valores.length}`);
        }

        if (produto) {
            valores.push(`%${produto}%`);
            filtros.push(`produto ILIKE $${valores.length}`);
        }

        if (filtros.length) {
            query += ' WHERE ' + filtros.join(' AND ');
        }

        query += ' ORDER BY id DESC';

        const resultado = await pool.query(query, valores);

        res.json(resultado.rows);

    } catch (error) {
        console.error('ERRO AO CARREGAR PRODUTOS:', error.message);
        res.status(500).json({ erro: 'Erro ao carregar produtos.' });
    }
});


// Rota de cadastro com suporte a imagem
app.post('/cadastrar-produto', upload.single('imagem'), async (req, res) => {
    try {
        const { vendedor, produto, preco, quantidade, provincia, contacto } = req.body;

        if (!vendedor || !produto || !preco || !provincia || !contacto) {
            return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
        }

        const caminhoImagem = req.file ? `/uploads/${req.file.filename}` : '';

        const resultado = await pool.query(
            `INSERT INTO produtos
            (vendedor, produto, preco, quantidade, provincia, contacto, imagem)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                vendedor,
                produto,
                preco,
                quantidade || '1',
                provincia,
                contacto,
                caminhoImagem
            ]
        );

        res.status(201).json({
            mensagem: 'Produto guardado com sucesso!',
            produto: resultado.rows[0]
        });

    } catch (error) {
        console.error('ERRO AO GUARDAR PRODUTO:', error.message);
        res.status(500).json({ erro: 'Erro ao guardar o produto.' });
    }
});

app.get('/precisos', async (req, res) => {
    try {
        let query = 'SELECT id, comprador, produto_desejado AS "produtoDesejado", quantidade, provincia, contacto, data FROM precisos';
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

app.post('/precisos', async (req, res) => {
    try {
        const { comprador, produtoDesejado, quantidade, provincia, contacto } = req.body;

        if (!comprador || !produtoDesejado || !provincia || !contacto) {
            return res.status(400).json({
                erro: 'Preencha todos os campos obrigatórios.'
            });
        }

        const resultado = await pool.query(
            `INSERT INTO precisos
            (comprador, produto_desejado, quantidade, provincia, contacto)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, comprador, produto_desejado AS "produtoDesejado", quantidade, provincia, contacto, data`,
            [
                comprador,
                produtoDesejado,
                quantidade || '1',
                provincia,
                contacto
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
