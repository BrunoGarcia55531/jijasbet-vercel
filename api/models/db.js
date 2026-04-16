const { Sequelize } = require('sequelize');

let sequelize = null;
let models = null;

const getSequelize = () => {
  if (sequelize) return sequelize;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL no configurada en las variables de entorno de Vercel');

  sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    dialectModule: require('pg'),
    logging: false,
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false }
    },
    pool: { max: 2, min: 0, acquire: 30000, idle: 10000 }
  });

  return sequelize;
};

const getModels = async () => {
  if (models) return models;

  const seq = getSequelize();

  const usuarioModel = require('./Usuario');
  const apuestaModel = require('./Apuesta');
  const eventoModel  = require('./Evento');
  const recargaModel = require('./Recarga');

  const Usuario = usuarioModel(seq);
  const Apuesta = apuestaModel(seq);
  const Evento  = eventoModel(seq);
  const Recarga = recargaModel(seq);

  Usuario.hasMany(Apuesta, { foreignKey: 'usuarioId', onDelete: 'CASCADE' });
  Apuesta.belongsTo(Usuario, { foreignKey: 'usuarioId' });
  Evento.hasMany(Apuesta,  { foreignKey: 'eventoId',  onDelete: 'CASCADE' });
  Apuesta.belongsTo(Evento, { foreignKey: 'eventoId' });
  Usuario.hasMany(Recarga, { foreignKey: 'usuarioId', onDelete: 'CASCADE' });
  Recarga.belongsTo(Usuario, { foreignKey: 'usuarioId' });

  await seq.authenticate();
  await seq.sync({ alter: true });

  models = { Usuario, Apuesta, Evento, Recarga };
  return models;
};

module.exports = { getModels };
