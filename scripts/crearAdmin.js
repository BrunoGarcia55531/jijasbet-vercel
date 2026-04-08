require('dotenv').config({ path: '.env.local' });
const { Sequelize } = require('sequelize');
const usuarioModel = require('../api/models/Usuario');
const eventoModel = require('../api/models/Evento');

async function crearAdminEjemplo() {
  const sequelize = new Sequelize(
    process.env.DB_NAME || 'jijasbet',
    process.env.DB_USER || 'jijasbet',
    process.env.DB_PASSWORD || 'jijasbet123',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5433,
      dialect: 'postgres',
      logging: false
    }
  );

  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL conectado');
    
    const Usuario = usuarioModel(sequelize);
    const Evento = eventoModel(sequelize);
    await sequelize.sync();
    
    console.log('🔄 Creando usuario admin de demo...');
    
    // Eliminar admin anterior si existe
    await Usuario.destroy({ where: { email: 'admin@test.com' } });
    
    // Crear nuevo admin
    const admin = await Usuario.create({
      nombre: 'Administrador',
      email: 'admin@test.com',
      contraseña: 'admin123',
      telefono: '999999999',
      esAdmin: true
    });
    
    console.log('✅ Admin creado exitosamente');
    console.log('📧 Email: admin@test.com');
    console.log('🔑 Contraseña: admin123');
    
    // Crear usuario regular de demo
    await Usuario.destroy({ where: { email: 'usuario@test.com' } });
    
    const usuario = await Usuario.create({
      nombre: 'Usuario Demo',
      email: 'usuario@test.com',
      contraseña: '123456',
      telefono: '988888888',
      esAdmin: false
    });
    
    console.log('✅ Usuario regular creado');
    console.log('📧 Email: usuario@test.com');
    console.log('🔑 Contraseña: 123456');
    
    // Crear eventos de prueba
    console.log('\n🔄 Creando eventos de prueba...');
    
    // Limpiar eventos anteriores
    await Evento.destroy({ where: {} });
    
    const ahora = new Date();
    const mañana = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
    const enTresDias = new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000);
    const enCincoDias = new Date(ahora.getTime() + 5 * 24 * 60 * 60 * 1000);
    
    const eventos = [
      {
        equipoLocal: 'Alianza Lima',
        equipoVisitante: 'Universitario',
        liga: 'Primera División',
        fechaPartido: mañana,
        cuotaLocal: 1.95,
        cuotaEmpate: 3.20,
        cuotaVisitante: 3.80,
        estado: 'activo'
      },
      {
        equipoLocal: 'Sporting Cristal',
        equipoVisitante: 'Boca Juniors',
        liga: 'Copa Libertadores',
        fechaPartido: enTresDias,
        cuotaLocal: 2.10,
        cuotaEmpate: 3.15,
        cuotaVisitante: 3.40,
        estado: 'activo'
      },
      {
        equipoLocal: 'Barcelona',
        equipoVisitante: 'Real Madrid',
        liga: 'LaLiga',
        fechaPartido: enCincoDias,
        cuotaLocal: 2.30,
        cuotaEmpate: 3.50,
        cuotaVisitante: 2.99,
        estado: 'activo'
      }
    ];
    
    for (const eventoData of eventos) {
      await Evento.create(eventoData);
      console.log(`✅ Evento creado: ${eventoData.equipoLocal} vs ${eventoData.equipoVisitante}`);
    }
    
    await sequelize.close();
    console.log('\n✅ Base de datos actualizada y conexión cerrada');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

crearAdminEjemplo();
