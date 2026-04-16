const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Recarga = sequelize.define('Recarga', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Usuarios', key: 'id' }
    },
    nombreUsuario: DataTypes.STRING,
    monto: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    comprobante: DataTypes.TEXT, // Base64
    numeroTransaccion: DataTypes.STRING,
    estado: {
      type: DataTypes.ENUM('pendiente', 'verificado', 'rechazado'),
      defaultValue: 'pendiente'
    },
    motivoRechazo: DataTypes.TEXT
  }, {
    timestamps: true
  });

  return Recarga;
};
