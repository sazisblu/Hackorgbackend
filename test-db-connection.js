require('dotenv').config();
const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Database connection successful!');
    
    const result = await client.query('SELECT version()');
    console.log('PostgreSQL version:', result.rows[0].version);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await client.end();
  }
}

testConnection();
