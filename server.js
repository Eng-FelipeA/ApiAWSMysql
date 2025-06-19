const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');

dotenv.config();
const app = express();
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true
}).promise();

const DB_NAME = process.env.DB_NAME;

// Swagger setup
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'API Produto',
      version: '1.0.0',
      description: 'CRUD de produtos com MySQL + endpoint de inicialização do banco'
    }
  },
  apis: ['server.js']
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * /init-db:
 *   post:
 *     summary: Cria o banco de dados e a tabela produto
 *     responses:
 *       200:
 *         description: Banco de dados e tabela criados com sucesso
 */
app.post('/init-db', async (req, res) => {
  try {
    const createDB = `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`; USE \`${DB_NAME}\`;
      CREATE TABLE IF NOT EXISTS produto (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        Nome VARCHAR(255) NOT NULL,
        Descricao VARCHAR(255) NOT NULL,
        Preco DECIMAL(10,2) NOT NULL
      );`;
    await pool.query(createDB);
    res.send('Banco de dados e tabela criados com sucesso.');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /produtos:
 *   get:
 *     summary: Lista todos os produtos
 *     responses:
 *       200:
 *         description: Lista de produtos
 */
app.get('/produtos', async (req, res) => {
  try {
    await pool.query(`USE \`${DB_NAME}\``);
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
    await pool.query(`USE \`${DB_NAME}\``);
    const [rows] = await pool.query('SELECT * FROM produto WHERE id = ?', [req.params.id]);
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
 */
app.post('/produtos', async (req, res) => {
  const { Nome, Descricao, Preco } = req.body;
  try {
    await pool.query(`USE \`${DB_NAME}\``);
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
 *       404:
 *         description: Produto não encontrado
 */
app.put('/produtos/:id', async (req, res) => {
  const { Nome, Descricao, Preco } = req.body;
  try {
    await pool.query(`USE \`${DB_NAME}\``);
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
    await pool.query(`USE \`${DB_NAME}\``);
    const [result] = await pool.query('DELETE FROM produto WHERE Id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json({ message: 'Produto deletado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Swagger em ${PORT}/swagger`);
});
