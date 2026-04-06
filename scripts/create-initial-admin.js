require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User, sequelize } = require('../src/models'); // Need sequelize to close connection

async function createAdmin() {
    try {
        const email = 'admin@admin.com';
        const password = 'AdminPassword123!';
        
        console.log("Checking for existing admin...");
        // Check if admin already exists
        const existingAdmin = await User.findOne({ where: { email } });
        if (existingAdmin) {
            console.log(`\nAdmin user with email ${email} already exists!`);
            process.exit(0);
        }

        console.log("Hashing password...");
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        console.log("Creating admin user in database...");
        const admin = await User.create({
            username: 'superadmin',
            email: email,
            full_name: 'System Administrator',
            role: 'admin',
            password_hash: password_hash,
            is_active: true,
            is_first_login: false
        });

        console.log(`\n✅ Successfully created initial admin user!`);
        console.log(`-------------------------------------------`);
        console.log(`Email: ${admin.email}`);
        console.log(`Username: ${admin.username}`);
        console.log(`Password: ${password}`);
        console.log(`-------------------------------------------\n`);
        
    } catch (error) {
        console.error('Error creating admin user:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

createAdmin();
