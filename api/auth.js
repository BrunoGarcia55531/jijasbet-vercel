const jwt = require('jsonwebtoken');
const { getModels } = require('./models/db');

const SECRET = process.env.JWT_SECRET || 'tu_secret_key_muy_seguro';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { Usuario } = await getModels();
  const url = req.url.split('?')[0];

  if (req.method === 'POST' && url.includes('/registro')) {
    try {
      const { nombre, email, contraseña, telefono } = req.body;
      if (!nombre || !email || !contraseña)
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
      const existe = await Usuario.findOne({ where: { email } });
      if (existe) return res.status(400).json({ error: 'Email ya registrado' });
      const usuario = await Usuario.create({ nombre, email, contraseña, telefono });
      const token = jwt.sign({ id: usuario.id, email: usuario.email }, SECRET, { expiresIn: '30d' });
      return res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email } });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (req.method === 'POST' && url.includes('/login')) {
    try {
      const { email, contraseña } = req.body;
      const usuario = await Usuario.findOne({ where: { email } });
      if (!usuario || !(await usuario.compararContraseña(contraseña)))
        return res.status(401).json({ error: 'Credenciales inválidas' });
      const token = jwt.sign({ id: usuario.id, email: usuario.email }, SECRET, { expiresIn: '30d' });
      return res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, esAdmin: usuario.esAdmin } });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (req.method === 'GET' && url.includes('/me')) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'No autorizado' });
      const decoded = jwt.verify(token, SECRET);
      return res.json(decoded);
    } catch (e) { return res.status(401).json({ error: 'Token inválido' }); }
  }

  return res.status(404).json({ error: 'Ruta no encontrada' });
};
