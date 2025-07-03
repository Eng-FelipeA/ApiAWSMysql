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

const mysql = require('mysql2/promise');

const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;
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

// Conectar uma única vez ao iniciar o app
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
 *     tags:
 *       - CRUD MongoDb
 *     summary: Testa a conexão com o MongoDB
 *     description: Verifica se a aplicação consegue se conectar ao MongoDB.
 *     responses:
 *       200:
 *         description: Conexão bem-sucedida
 *       500:
 *         description: Erro na conexão com o MongoDB
 */
app.get('/mongodb/testar-conexao', async (req, res) => {
  try {
    // Usar conexão já aberta
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
 *     tags:
 *       - CRUD MongoDb
 *     summary: Criar um novo usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 description: Nome do usuário
 *               email:
 *                 type: string
 *                 description: Email do usuário
 *             required:
 *               - nome
 *               - email
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   description: ID do usuário
 *                 nome:
 *                   type: string
 *                 email:
 *                   type: string
 *       400:
 *         description: Requisição inválida.
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

app.put('/usuarios/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!user) return res.status(404).send('Usuário não encontrado');

    logInfo('Usuário atualizado', req);
    res.send(user);
  } catch (error) {
    logError("Erro ao atualizar usuário", req, error);
    res.status(500).send('Ocorreu um erro interno');
  }
});

app.delete('/usuarios/:id', async (req, res) => {
  try {
    const result = await User.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).send('Usuário não encontrado');
    }

    logInfo('Usuário removido', req);
    res.send({ message: 'Usuário removido com sucesso' });
  } catch (error) {
    logError("Erro ao remover usuário", req, error);
    res.status(500).send('Ocorreu um erro interno');
  }
});

//#endregion

//#region AWS S3

AWS.config.update({
  region: process.env.REGION,
  // Se necessário, pode habilitar as keys aqui
  // accessKeyId: process.env.ACCESS_KEY_ID,
  // secretAccessKey: process.env.SECRET_ACCESS_KEY,
  // sessionToken: process.env.SESSION_TOKEN,
});

const s3 = new AWS.S3();

app.get('/buckets', async (req, res) => {
  try {
    const data = await s3.listBuckets().promise();
    logInfo('Buckets encontrados', req);
    res.status(200).json(data.Buckets);
  } catch (error) {
    logError("Erro ao buscar buckets", req, error);
    res.status(500).json({ error: 'Erro ao listar buckets', details: error.message });
  }
});

app.get('/buckets/:bucketName', async (req, res) => {
  const { bucketName } = req.params;
  const params = { Bucket: bucketName };

  try {
    const data = await s3.listObjectsV2(params).promise();
    logInfo('Objetos encontrados', req);
    res.status(200).json(data.Contents);
  } catch (error) {
    logError("Erro ao buscar objetos", req, error);
    res.status(500).json({ error: 'Erro ao listar objetos do bucket', details: error.message });
  }
});

// Configuração do multer para armazenar arquivo na memória
const upload = multer({ storage: multer.memoryStorage() });

app.post('/buckets/:bucketName/upload', upload.single('file'), async (req, res) => {
  const { bucketName } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
  }

  const params = {
    Bucket: bucketName,
    Key: file.originalname,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    const data = await s3.upload(params).promise();
    logInfo('Upload efetuado', req);
    res.status(200).json({ message: 'Upload concluído com sucesso', data });
  } catch (error) {
    logError('Erro ao efetuar upload', req, error);
    res.status(500).json({ message: 'Erro no upload', error: error.message });
  }
});

app.delete('/buckets/:bucketName/file/:fileName', async (req, res) => {
  const { bucketName, fileName } = req.params;
  const params = {
    Bucket: bucketName,
    Key: fileName
  };

  try {
    await s3.deleteObject(params).promise();
    logInfo('Arquivo deletado', req);
    res.status(200).json({ message: 'Arquivo deletado com sucesso' });
  } catch (error) {
    logError("Erro ao remover objeto", req, error);
    res.status(500).json({ message: 'Erro ao deletar arquivo', error: error.message });
  }
});

//#endregion

//#region MySQL

const DB_NAME = process.env.DB_NAME || 'mydatabase';

app.post('/init-db', async (req, res) => {
  try {
    const createDB = `
      CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;
      USE \`${DB_NAME}\`;
      CREATE TABLE IF NOT EXISTS produto (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        Nome VARCHAR(255) NOT NULL,
        Descricao VARCHAR(255) NOT NULL,
        Preco DECIMAL(10,2) NOT NULL
      );
    `;
    const connection = await pool.getConnection();
    await connection.query(createDB);
    connection.release();
    res.send('Banco de dados e tabela criados com sucesso.');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

app.get('/produtos/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query(`USE \`${DB_NAME}\``);
    const [rows] = await connection.query('SELECT * FROM produto WHERE Id = ?', [req.params.id]);
    connection.release();
    if (rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/produtos', async (req, res) => {
  const { Nome, Descricao, Preco } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(`USE \`${DB_NAME}\``);
    const [result] = await connection.query(
      'INSERT INTO produto (Nome, Descricao, Preco) VALUES (?, ?, ?)',
      [Nome, Descricao, Preco]
    );
    connection.release();
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/produtos/:id', async (req, res) => {
  const { Nome, Descricao, Preco } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(`USE \`${DB_NAME}\``);
    const [result] = await connection.query(
      'UPDATE produto SET Nome = ?, Descricao = ?, Preco = ? WHERE Id = ?',
      [Nome, Descricao, Preco, req.params.id]
    );
    connection.release();
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json({ message: 'Produto atualizado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/produtos/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query(`USE \`${DB_NAME}\``);
    const [result] = await connection.query('DELETE FROM produto WHERE Id = ?', [req.params.id]);
    connection.release();
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json({ message: 'Produto deletado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//#endregion

swaggerDocs(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor rodando na porta ${PORT}`));

