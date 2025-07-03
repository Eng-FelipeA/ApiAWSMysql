require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const multer = require('multer');

const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const mysql = require('mysql2/promise');

const swaggerDocs = require('./swagger');
const { logInfo, logError } = require('./logger');

const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME || 'mydatabase';
const DB_PORT = process.env.DB_PORT || 3306;

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  port: DB_PORT
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: '*'
}));

app.use(express.json());

//#region MongoDB

console.log('MONGO_URI:', process.env.MONGO_URI);  // DEBUG para ver se está carregando

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => logInfo('MongoDB conectado', null))
  .catch(err => logError('Erro ao conectar ao MongoDB: ' + err, null, err));

const UserSchema = new mongoose.Schema({
  nome: String,
  email: String
});

const User = mongoose.model('Usuario', UserSchema);

/**
 * @swagger
 * /mongodb/testar-conexao:
 *   get:
 *     summary: Testa conexão com MongoDB e verifica se existe algum usuário
 *     tags:
 *       - MongoDB
 *     responses:
 *       200:
 *         description: Conexão realizada e status do usuário retornado
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       500:
 *         description: Erro na conexão com MongoDB
 */
app.get('/mongodb/testar-conexao', async (req, res) => {
  try {
    const user = await User.findOne();
    logInfo('Conexão com o MongoDB efetuada com sucesso', req);
    if (user) {
      res.status(200).send('Conexão com o MongoDB bem-sucedida e usuário encontrado!');
    } else {
      res.status(200).send('Conexão com o MongoDB bem-sucedida, mas nenhum usuário encontrado.');
    }
  } catch (error) {
    logError('Erro ao conectar no MongoDb: ' + error, req, error);
    res.status(500).send('Erro na conexão com o MongoDB');
  }
});

/**
 * @swagger
 * /usuarios:
 *   post:
 *     summary: Cria um novo usuário
 *     tags:
 *       - Usuários
 *     requestBody:
 *       description: Dados do usuário a ser criado
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *               - email
 *             properties:
 *               nome:
 *                 type: string
 *                 example: João Silva
 *               email:
 *                 type: string
 *                 example: joao@email.com
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Usuario'
 *       500:
 *         description: Erro interno no servidor
 */
app.post('/usuarios', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    logInfo('Usuário criado', req);
    res.status(201).send(user);
  } catch (error) {
    logError("Erro ao criar usuário", req, error);
    res.status(500).send('Ocorreu um erro interno');
  }
});

/**
 * @swagger
 * /usuarios:
 *   get:
 *     summary: Retorna todos os usuários cadastrados
 *     tags:
 *       - Usuários
 *     responses:
 *       200:
 *         description: Lista de usuários retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Usuario'
 *       500:
 *         description: Erro interno no servidor
 */
app.get('/usuarios', async (req, res) => {
  try {
    const users = await User.find();
    logInfo('Usuários encontrados', req);
    res.send(users);
  } catch (error) {
    logError("Erro ao buscar usuários", req, error);
    res.status(500).send('Ocorreu um erro interno');
  }
});

/**
 * @swagger
 * /usuarios/{id}:
 *   get:
 *     summary: Busca um usuário pelo ID
 *     tags:
 *       - Usuários
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Usuário encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Usuario'
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro interno no servidor
 */
app.get('/usuarios/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('Usuário não encontrado');

    logInfo('Usuário encontrado', req);
    res.send(user);
  } catch (error) {
    logError("Erro ao buscar usuário", req, error);
    res.status(500).send('Ocorreu um erro interno');
  }
});

// Continue da mesma forma para os demais endpoints (PUT, DELETE usuários etc)

//#region Swagger Components (para modelagem dos schemas)
 
/**
 * @swagger
 * components:
 *   schemas:
 *     Usuario:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID do usuário gerado pelo MongoDB
 *           example: 60d0fe4f5311236168a109ca
 *         nome:
 *           type: string
 *           example: João Silva
 *         email:
 *           type: string
 *           example: joao@email.com
 */

//#endregion

//#region AWS S3

// Adicione também Swagger para AWS S3 se desejar, seguindo o mesmo padrão de documentação

//#endregion

//#region MySQL

/**
 * @swagger
 * /produtos:
 *   get:
 *     summary: Lista todos os produtos
 *     tags:
 *       - Produtos
 *     responses:
 *       200:
 *         description: Lista de produtos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Produto'
 *       500:
 *         description: Erro interno no servidor
 */
app.get('/produtos', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query(`USE \`${DB_NAME}\``);
    const [rows] = await connection.query('SELECT * FROM produto');
    connection.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Produto:
 *       type: object
 *       properties:
 *         Id:
 *           type: integer
 *           example: 1
 *         Nome:
 *           type: string
 *           example: Produto A
 *         Descricao:
 *           type: string
 *           example: Produto de exemplo
 *         Preco:
 *           type: number
 *           format: float
 *           example: 99.90
 */

// Continue para os demais endpoints do MySQL (GET /produtos/:id, POST /produtos, PUT, DELETE) seguindo o padrão dos comentários acima

//#endregion

swaggerDocs(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor rodando na porta ${PORT}`));
