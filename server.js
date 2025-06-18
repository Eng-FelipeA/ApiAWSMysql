const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
 
dotenv.config();
const app = express();
app.use(express.json());
 
//#region Configuração da pool MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true
}).promise();
//#endregion
 
//#region Configuração Swagger
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'API Produto',
      version: '1.0.0',
      description: 'CRUD de produtos com MySQL + endpoint de inicialização do banco'
    },
    tags: [
      {
        name: 'CRUD MySQL',
        description: 'Operações de CRUD para produtos no MySQL.'
      }
    ],
    servers: [
      { url: `http://localhost:${process.env.PORT || 3000}` }
    ]
  },
  apis: ['server.js']
};
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
//#endregion
 
//#region Endpoint de health check
app.get('/', (req, res) => {
  res.send('API rodando com sucesso 🚀');
});
//#endregion
 
//#region Endpoint para inicializar banco e tabela
 
/**
* @swagger
* /init-db:
*   post:
*     summary: Cria o banco de dados e a tabela produto
*     tags: [CRUD MySQL]
*     responses:
*       200:
*         description: Banco de dados e tabela criados com sucesso
*       500:
*         description: Erro interno
*/
app.post('/init-db', async (req, res) => {
  try {
    const createDB = `
      CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;
      USE \`${process.env.DB_NAME}\`;
      CREATE TABLE IF NOT EXISTS produto (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        Nome VARCHAR(255) NOT NULL,
        Descricao VARCHAR(255) NOT NULL,
        Preco DECIMAL(10,2) NOT NULL
      );
    `;
    await pool.query(createDB);
    res.send('Banco de dados e tabela criados com sucesso.');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
//#endregion
 
//#region CRUD Produtos - MySQL
 
/**
* @swagger
* /produtos:
*   get:
*     summary: Lista todos os produtos
*     tags: [CRUD MySQL]
*     responses:
*       200:
*         description: Lista de produtos
*/
app.get('/produtos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM produto');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
/**
* @swagger
* /produtos/{id}:
*   get:
*     summary: Busca um produto pelo ID
*     tags: [CRUD MySQL]
*     parameters:
*       - in: path
*         name: id
*         required: true
*         schema:
*           type: integer
*     responses:
*       200:
*         description: Produto encontrado
*       404:
*         description: Produto não encontrado
*/
app.get('/produtos/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM produto WHERE Id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
/**
* @swagger
* /produtos:
*   post:
*     summary: Cria um novo produto
*     tags: [CRUD MySQL]
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             type: object
*             required:
*               - Nome
*               - Descricao
*               - Preco
*             properties:
*               Nome:
*                 type: string
*               Descricao:
*                 type: string
*               Preco:
*                 type: number
*     responses:
*       201:
*         description: Produto criado
*       400:
*         description: Requisição inválida
*/
app.post('/produtos', async (req, res) => {
  const { Nome, Descricao, Preco } = req.body;
  if (!Nome || !Descricao || Preco == null) {
    return res.status(400).json({ error: 'Campos obrigatórios: Nome, Descricao, Preco' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO produto (Nome, Descricao, Preco) VALUES (?, ?, ?)',
      [Nome, Descricao, Preco]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
/**
* @swagger
* /produtos/{id}:
*   put:
*     summary: Atualiza um produto
*     tags: [CRUD MySQL]
*     parameters:
*       - in: path
*         name: id
*         required: true
*         schema:
*           type: integer
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             type: object
*             required:
*               - Nome
*               - Descricao
*               - Preco
*             properties:
*               Nome:
*                 type: string
*               Descricao:
*                 type: string
*               Preco:
*                 type: number
*     responses:
*       200:
*         description: Produto atualizado
*       400:
*         description: Requisição inválida
*       404:
*         description: Produto não encontrado
*/
app.put('/produtos/:id', async (req, res) => {
  const { Nome, Descricao, Preco } = req.body;
  if (!Nome || !Descricao || Preco == null) {
    return res.status(400).json({ error: 'Campos obrigatórios: Nome, Descricao, Preco' });
  }
  try {
    const [result] = await pool.query(
      'UPDATE produto SET Nome = ?, Descricao = ?, Preco = ? WHERE Id = ?',
      [Nome, Descricao, Preco, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json({ message: 'Produto atualizado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
/**
* @swagger
* /produtos/{id}:
*   delete:
*     summary: Deleta um produto
*     tags: [CRUD MySQL]
*     parameters:
*       - in: path
*         name: id
*         required: true
*         schema:
*           type: integer
*     responses:
*       200:
*         description: Produto deletado com sucesso
*       404:
*         description: Produto não encontrado
*/
app.delete('/produtos/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM produto WHERE Id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json({ message: 'Produto deletado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
//#endregion
 
//#region Inicialização do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Swagger disponível em http://localhost:${PORT}/swagger`);
});
//#endregion