const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
app.use(express.json());
app.use(cors());

// Servir a pasta de uploads publicamente para as imagens aparecerem no site
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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

let baseDados = carregarDados();

app.get('/produtos', (req, res) => {
    let p = baseDados.produtos;
    const { provincia, produto } = req.query;
    if (provincia) p = p.filter(x => x.provincia.toLowerCase() === provincia.toLowerCase());
    if (produto) p = p.filter(x => x.produto.toLowerCase().includes(produto.toLowerCase()));
    res.json(p);
});

// Rota de cadastro com suporte a imagem
app.post('/cadastrar-produto', upload.single('imagem'), (req, res) => {
    const { vendedor, produto, preco, quantidade, provincia } = req.body;
    if (!vendedor || !produto || !preco || !provincia) {
        return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
    }
    const caminhoImagem = req.file ? `/uploads/${req.file.filename}` : '';
    const novo = {
        id: baseDados.produtos.length ? baseDados.produtos[baseDados.produtos.length - 1].id + 1 : 1,
        vendedor, produto, preco, quantidade: quantidade || '1', provincia,
        imagem: caminhoImagem,
        data: new Date().toISOString()
    };
    baseDados.produtos.push(novo);
    guardarDados(baseDados);
    res.status(201).json({ mensagem: 'Produto guardado com sucesso!', produto: novo });
});

app.get('/precisos', (req, res) => {
    let p = baseDados.precisos;
    const { provincia } = req.query;
    if (provincia) p = p.filter(x => x.provincia.toLowerCase() === provincia.toLowerCase());
    res.json(p);
});

app.post('/precisos', (req, res) => {
    const { comprador, produtoDesejado, quantidade, provincia, contacto } = req.body;
    if (!comprador || !produtoDesejado || !provincia || !contacto) {
        return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
    }
    const novo = {
        id: baseDados.precisos.length ? baseDados.precisos[baseDados.precisos.length - 1].id + 1 : 1,
        comprador, produtoDesejado, quantidade: quantidade || '1', provincia, contacto,
        data: new Date().toISOString()
    };
    baseDados.precisos.push(novo);
    guardarDados(baseDados);
    res.status(201).json({ mensagem: 'Necessidade guardada com sucesso!', pedido: novo });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor com imagens a correr na porta ${PORT}`);
});
