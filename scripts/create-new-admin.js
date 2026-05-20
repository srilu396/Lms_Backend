require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User, sequelize } = require('../src/models');

async function createNewAdmin() {
    try {
        const email = 'saiadmin@gmail.com';
        const password = 'P@55word';
        
        console.log("🔧 Starting admin user creation process...\n");
        console.log("Hashing password...");
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        console.log("Checking for existing admin with this email...");
        let admin = await User.findOne({ where: { email } });
        
        if (admin) {
            console.log(`\n⚠️  Admin user already exists. Forcing password reset!`);
            admin.password_hash = password_hash;
            await admin.save();
            console.log(`✅ Password updated successfully!`);
        } else {
            console.log("Creating new admin user in database...");
            admin = await User.create({
                username: 'saiadmin',
                email: email,
                full_name: 'Sai Admin',
                role: 'admin',
                password_hash: password_hash,
                is_active: true,
                is_first_login: false
            });
            console.log(`✅ New admin user created successfully!`);
        }

        console.log(`\n${'='.repeat(50)}`);
        console.log(`✅ ADMIN USER CONFIGURED SUCCESSFULLY!`);
        console.log(`${'='.repeat(50)}`);
        console.log(`📧 Email:    ${admin.email}`);
        console.log(`🔐 Password: ${password}`);
        console.log(`👤 Username: ${admin.username}`);
        console.log(`📝 Full Name: ${admin.full_name}`);
        console.log(`📍 Role:     ${admin.role}`);
        console.log(`${'='.repeat(50)}\n`);
        
    } catch (error) {
        console.error('❌ Error creating admin user:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

createNewAdmin();
