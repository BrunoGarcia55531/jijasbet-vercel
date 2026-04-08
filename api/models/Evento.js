const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Evento = sequelize.define('Evento', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    equipoLocal: {
      type: DataTypes.STRING,
      allowNull: false
    },
    equipoVisitante: {
      type: DataTypes.STRING,
      allowNull: false
    },
    liga: DataTypes.STRING,
    fechaPartido: {
      type: DataTypes.DATE,
      allowNull: false
    },
    cuotaLocal: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false
    },
    cuotaEmpate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false
    },
    cuotaVisitante: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false
    },
    resultadoPartido: DataTypes.STRING, // 'local', 'empate', 'visitante'
    estado: {
      type: DataTypes.ENUM('activo', 'finalizado', 'cancelado'),
      defaultValue: 'activo'
    }
  }, {
    timestamps: true
  });

  return Evento;
};
