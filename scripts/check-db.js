const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:Srilu396@@localhost:5432/lms_db' });
client.connect().then(() => client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'institutions';"))
    .then(res => { console.log(res.rows.map(r => r.column_name)); client.end(); })
    .catch(err => { console.error(err); client.end(); });
