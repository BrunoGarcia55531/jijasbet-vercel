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

    // Probabilidades base (se actualizan con eventos del partido)
    probBaseLocal:      { type: DataTypes.DECIMAL(5, 4), defaultValue: 0.3500 },
    probBaseEmpate:     { type: DataTypes.DECIMAL(5, 4), defaultValue: 0.3000 },
    probBaseVisitante:  { type: DataTypes.DECIMAL(5, 4), defaultValue: 0.3500 },

    // Volumen de apuestas por opción
    montoApostadoLocal:     { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    montoApostadoEmpate:    { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    montoApostadoVisitante: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },

    // Margen de la casa
    margen: { type: DataTypes.DECIMAL(4, 3), defaultValue: 0.080 },

    // Estado del partido en vivo
    fase: {
      type: DataTypes.ENUM('pre', 'primera_mitad', 'descanso', 'segunda_mitad', 'finalizado'),
      defaultValue: 'pre'
    },
    minuto:          { type: DataTypes.INTEGER, defaultValue: 0 },
    golesLocal:      { type: DataTypes.INTEGER, defaultValue: 0 },
    golesVisitante:  { type: DataTypes.INTEGER, defaultValue: 0 },
    rojaLocal:       { type: DataTypes.INTEGER, defaultValue: 0 }, // tarjetas rojas acumuladas
    rojaVisitante:   { type: DataTypes.INTEGER, defaultValue: 0 },

    // Historial de eventos del partido (JSON array)
    historialEventos: { type: DataTypes.TEXT, defaultValue: '[]' },

    // Momento en que el partido comenzó (para calcular minuto automáticamente)
    inicioPartido:   { type: DataTypes.DATE, allowNull: true },

    resultadoPartido: DataTypes.STRING,
    estado: {
      type: DataTypes.ENUM('activo', 'finalizado', 'cancelado'),
      defaultValue: 'activo'
    }
  }, { timestamps: true });

  return Evento;
};
