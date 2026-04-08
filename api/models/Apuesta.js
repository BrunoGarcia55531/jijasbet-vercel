const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Apuesta = sequelize.define('Apuesta', {
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
    eventoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Eventos', key: 'id' }
    },
    nombreUsuario: DataTypes.STRING,
    
    // Apuesta
    tipoApuesta: DataTypes.STRING, // local, empate, visitante
    montoApuesta: DataTypes.DECIMAL(10, 2),
    cuota: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    montoGanancia: DataTypes.DECIMAL(10, 2),
    
    // Pago Yape
    comprobante: DataTypes.TEXT, // Base64
    numeroTransaccion: DataTypes.STRING,
    montoPagado: DataTypes.DECIMAL(10, 2),
    estadoPago: {
      type: DataTypes.ENUM('pendiente', 'verificado', 'rechazado'),
      defaultValue: 'pendiente'
    },
    motivoRechazo: DataTypes.TEXT,
    
    // Resultado
    resultadoPartido: DataTypes.STRING, // local, empate, visitante
    apuestaGanada: DataTypes.BOOLEAN
  }, {
    timestamps: true
  });

  return Apuesta;
};

