const jwt = require('jsonwebtoken');
const { User, sequelize } = require('./src/models'); // Using sequelize directly to get a real user

async function testNotifications() {
    try {
        // Find a real user
        const user = await User.findOne({ where: { role: 'student' } });
        if (!user) {
            console.log("No student user found. Cannot test without a real user.");
            process.exit(0);
        }

        console.log(`Testing with real user ID: ${user.id}`);

        // Create token with userId
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role, full_name: user.full_name },
            'your_access_secret_here',
            { expiresIn: '1h' }
        );

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        console.log("1. Fetching all notifications...");
        let res = await fetch('http://localhost:5000/api/v1/notifications', { headers });
        let data = await res.json();
        console.log("GET /api/v1/notifications Response:", JSON.stringify(data, null, 2));

        if (data.data && data.data.notifications && data.data.notifications.length > 0) {
            const notifId = data.data.notifications[0].id;
            console.log(`\n2. Marking notification ${notifId} as read...`);
            res = await fetch(`http://localhost:5000/api/v1/notifications/${notifId}/read`, { method: 'PATCH', headers });
            data = await res.json();
            console.log(`PATCH /api/v1/notifications/${notifId}/read Response:`, JSON.stringify(data, null, 2));
        } else {
            console.log("\n2. No notifications found to mark as read. Creating one in DB first via service...");
            const { createNotification } = require('./src/notifications/notification.service');
            await createNotification({
                userId: user.id, role: user.role, type: 'TEST', title: 'Test Notif', message: 'This is a test notification.'
            });
            console.log("Notification created. Fetching again...");
            res = await fetch('http://localhost:5000/api/v1/notifications', { headers });
            data = await res.json();
            console.log("GET /api/v1/notifications Response (after create):", JSON.stringify(data, null, 2));
            
            if(data.data && data.data.notifications && data.data.notifications.length > 0){
                const notifId = data.data.notifications[0].id;
                console.log(`\n2. Marking notification ${notifId} as read...`);
                res = await fetch(`http://localhost:5000/api/v1/notifications/${notifId}/read`, { method: 'PATCH', headers });
                data = await res.json();
                console.log(`PATCH /api/v1/notifications/${notifId}/read Response:`, JSON.stringify(data, null, 2));
            }
        }

        console.log("\n3. Marking all as read...");
        res = await fetch('http://localhost:5000/api/v1/notifications/read-all', { method: 'PATCH', headers });
        data = await res.json();
        console.log("PATCH /api/v1/notifications/read-all Response:", JSON.stringify(data, null, 2));
        
        console.log("\n4. Final check of unread count...");
        res = await fetch('http://localhost:5000/api/v1/notifications', { headers });
        data = await res.json();
        console.log(`Unread count: ${data.data.unread_count}`);

        await sequelize.close();

    } catch (e) {
        console.error("Test failed:", e);
        try { await sequelize.close(); } catch(err){}
    }
}

testNotifications();
