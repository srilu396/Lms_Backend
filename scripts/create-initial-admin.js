require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User, sequelize } = require('../src/models'); // Need sequelize to close connection

async function createAdmin() {
    try {
        const email = 'superadmin@lms.com';
        const password = 'SuperLmsPassword@2026';
        
        console.log("Hashing password...");
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        console.log("Checking for existing admin...");
        // Check if admin already exists by username or email
        let admin = await User.findOne({ where: { username: 'superadmin' } });
        
        if (!admin) {
            admin = await User.findOne({ where: { email } });
        }
        
        if (admin) {
            console.log(`\nAdmin user exists. Forcing password reset!`);
            admin.password_hash = password_hash;
            await admin.save();
        } else {
            console.log("Creating new admin user in database...");
            admin = await User.create({
                username: 'superadmin',
                email: email,
                full_name: 'Ultimate System Administrator',
                role: 'admin',
                password_hash: password_hash,
                is_active: true,
                is_first_login: false
            });
        }

        console.log(`\n✅ Successfully configured Admin User!`);
        console.log(`-------------------------------------------`);
        console.log(`Email: ${admin.email}`);
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
