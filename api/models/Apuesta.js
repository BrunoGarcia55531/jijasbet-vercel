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

    // Estado de la apuesta (ya no depende del pago)
    estado: {
      type: DataTypes.ENUM('activa', 'ganada', 'perdida', 'cancelada'),
      defaultValue: 'activa'
    },

    // Resultado (se llena cuando el admin cierra el evento)
    apuestaGanada: DataTypes.BOOLEAN
  }, {
    timestamps: true
  });

  return Apuesta;
};
