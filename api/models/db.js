const { Sequelize } = require('sequelize');

let sequelize = null;
let models = null;

const getSequelize = () => {
  if (sequelize) return sequelize;

  if (process.env.DATABASE_URL) {
    // Neon / Supabase / Railway — connection string completa
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
      pool: { max: 3, min: 0, acquire: 30000, idle: 10000 }
    });
  } else {
    sequelize = new Sequelize(
      process.env.DB_NAME || 'jijasbet',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
          ssl: process.env.DB_SSL === 'true' ? { require: true, rejectUnauthorized: false } : false
        },
        pool: { max: 3, min: 0, acquire: 30000, idle: 10000 }
      }
    );
  }

  return sequelize;
};

const getModels = async () => {
  if (models) return models;

  const seq = getSequelize();

  const usuarioModel = require('./Usuario');
  const apuestaModel = require('./Apuesta');
  const eventoModel  = require('./Evento');

  const Usuario = usuarioModel(seq);
  const Apuesta = apuestaModel(seq);
  const Evento  = eventoModel(seq);

  Usuario.hasMany(Apuesta, { foreignKey: 'usuarioId', onDelete: 'CASCADE' });
  Apuesta.belongsTo(Usuario, { foreignKey: 'usuarioId' });
  Evento.hasMany(Apuesta,  { foreignKey: 'eventoId',  onDelete: 'CASCADE' });
  Apuesta.belongsTo(Evento, { foreignKey: 'eventoId' });

  await seq.authenticate();
  await seq.sync();

  models = { Usuario, Apuesta, Evento };
  return models;
};

module.exports = { getModels };
