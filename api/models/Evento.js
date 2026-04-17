const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Evento = sequelize.define('Evento', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    equipoLocal:     { type: DataTypes.STRING, allowNull: false },
    equipoVisitante: { type: DataTypes.STRING, allowNull: false },
    liga:            DataTypes.STRING,
    fechaPartido:    { type: DataTypes.DATE, allowNull: false },

    // Cuotas actuales (se recalculan dinámicamente)
    cuotaLocal:      { type: DataTypes.DECIMAL(6, 3), allowNull: false },
    cuotaEmpate:     { type: DataTypes.DECIMAL(6, 3), allowNull: false },
    cuotaVisitante:  { type: DataTypes.DECIMAL(6, 3), allowNull: false },

    // Probabilidades base iniciales (fijadas por el admin al crear el evento)
    probBaseLocal:      { type: DataTypes.DECIMAL(5, 4), defaultValue: 0.3500 },
    probBaseEmpate:     { type: DataTypes.DECIMAL(5, 4), defaultValue: 0.3000 },
    probBaseVisitante:  { type: DataTypes.DECIMAL(5, 4), defaultValue: 0.3500 },

    // Acumulado de dinero apostado en cada opción (para ajuste dinámico)
    montoApostadoLocal:     { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    montoApostadoEmpate:    { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    montoApostadoVisitante: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },

    // Margen de la casa (overround). Default 8%
    margen: { type: DataTypes.DECIMAL(4, 3), defaultValue: 0.080 },

    resultadoPartido: DataTypes.STRING,
    estado: {
      type: DataTypes.ENUM('activo', 'finalizado', 'cancelado'),
      defaultValue: 'activo'
    }
  }, { timestamps: true });

  return Evento;
};
