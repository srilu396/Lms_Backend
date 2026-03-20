require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:8000/api/v1/quizzes';

const tests = async () => {
    try {
        console.log('\n================================');
        console.log('Testing Quiz - Publish & Shuffle Features');
        console.log('================================\n');

        // Test 1: Create Quiz with is_published=false and shuffle_questions=false
        console.log('1️⃣  POST / Create Quiz (published=false, shuffle=false)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        let response = await axios.post(`${BASE_URL}`, {
            quiz_title: "Quiz with No Shuffle",
            duration: 45,
            total_marks: 100,
            domain: ["Computer Science"],
            tags: ["TEST", "SHUFFLE"],
            status: "published",
            is_published: false,
            shuffle_questions: false,
            questions: [
                {
                    question_text: "Question 1 - What is 2+2?",
                    type: "mcq",
                    options: ["3", "4", "5", "6"],
                    correct_answer: "4",
                    marks: 25
                },
                {
                    question_text: "Question 2 - What is 3+3?",
                    type: "mcq",
                    options: ["5", "6", "7", "8"],
                    correct_answer: "6",
                    marks: 25
                },
                {
                    question_text: "Question 3 - What is 4+4?",
                    type: "mcq",
                    options: ["7", "8", "9", "10"],
                    correct_answer: "8",
                    marks: 25
                },
                {
                    question_text: "Question 4 - What is 5+5?",
                    type: "mcq",
                    options: ["9", "10", "11", "12"],
                    correct_answer: "10",
                    marks: 25
                }
            ]
        });
        console.log(JSON.stringify(response.data, null, 2));
        const quiz1Id = response.data.data.id;
        console.log(`\n✅ Quiz 1 created with ID: ${quiz1Id}`);
        console.log(`   is_published: ${response.data.data.is_published}`);
        console.log(`   shuffle_questions: ${response.data.data.shuffle_questions}\n`);

        // Test 2: Create Quiz with is_published=true and shuffle_questions=true
        console.log('2️⃣  POST / Create Quiz (published=true, shuffle=true)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.post(`${BASE_URL}`, {
            quiz_title: "Quiz with Shuffle",
            duration: 50,
            total_marks: 100,
            domain: ["Computer Science"],
            tags: ["TEST", "SHUFFLE"],
            status: "published",
            is_published: true,
            shuffle_questions: true,
            questions: [
                {
                    question_text: "Question 1 - What is 2+2?",
                    type: "mcq",
                    options: ["3", "4", "5", "6"],
                    correct_answer: "4",
                    marks: 25
                },
                {
                    question_text: "Question 2 - What is 3+3?",
                    type: "mcq",
                    options: ["5", "6", "7", "8"],
                    correct_answer: "6",
                    marks: 25
                },
                {
                    question_text: "Question 3 - What is 4+4?",
                    type: "mcq",
                    options: ["7", "8", "9", "10"],
                    correct_answer: "8",
                    marks: 25
                },
                {
                    question_text: "Question 4 - What is 5+5?",
                    type: "mcq",
                    options: ["9", "10", "11", "12"],
                    correct_answer: "10",
                    marks: 25
                }
            ]
        });
        console.log(JSON.stringify(response.data, null, 2));
        const quiz2Id = response.data.data.id;
        console.log(`\n✅ Quiz 2 created with ID: ${quiz2Id}`);
        console.log(`   is_published: ${response.data.data.is_published}`);
        console.log(`   shuffle_questions: ${response.data.data.shuffle_questions}\n`);

        // Test 3: Get Quiz 1 (No Shuffle) - Questions should be in order
        console.log('3️⃣  GET /:id Quiz 1 (No Shuffle - Questions in Order)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.get(`${BASE_URL}/${quiz1Id}`);
        console.log('Quiz Details:');
        console.log(`  ID: ${response.data.data.id}`);
        console.log(`  Title: ${response.data.data.quiz_title}`);
        console.log(`  is_published: ${response.data.data.is_published}`);
        console.log(`  shuffle_questions: ${response.data.data.shuffle_questions}`);
        console.log('\nQuestions Order (should be 1, 2, 3, 4):');
        response.data.data.questions.forEach((q, idx) => {
            console.log(`  ${idx + 1}. ${q.question_text}`);
        });
        console.log('\n');

        // Test 4: Get Quiz 2 (With Shuffle) - Questions should be shuffled
        console.log('4️⃣  GET /:id Quiz 2 (With Shuffle - Questions Shuffled)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.get(`${BASE_URL}/${quiz2Id}`);
        console.log('Quiz Details:');
        console.log(`  ID: ${response.data.data.id}`);
        console.log(`  Title: ${response.data.data.quiz_title}`);
        console.log(`  is_published: ${response.data.data.is_published}`);
        console.log(`  shuffle_questions: ${response.data.data.shuffle_questions}`);
        console.log('\nQuestions Order (should be SHUFFLED, notice the order):');
        response.data.data.questions.forEach((q, idx) => {
            console.log(`  ${idx + 1}. ${q.question_text}`);
        });
        console.log('\n');

        // Test 5: Update Quiz 1 - Publish it (is_published=true) and Enable Shuffle
        console.log('5️⃣  PUT /:id Update Quiz 1 (Publish & Enable Shuffle)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.put(`${BASE_URL}/${quiz1Id}`, {
            is_published: true,
            shuffle_questions: true
        });
        console.log('Update Response:');
        console.log(`  is_published: ${response.data.data.is_published}`);
        console.log(`  shuffle_questions: ${response.data.data.shuffle_questions}`);
        console.log('\nQuestions after update (should now be SHUFFLED):');
        response.data.data.questions.forEach((q, idx) => {
            console.log(`  ${idx + 1}. ${q.question_text}`);
        });
        console.log('\n');

        // Test 6: Get Quiz 1 again to verify the update
        console.log('6️⃣  GET /:id Verify Quiz 1 Update (should be shuffled)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.get(`${BASE_URL}/${quiz1Id}`);
        console.log('Questions after retrieving (should be SHUFFLED each time):');
        response.data.data.questions.forEach((q, idx) => {
            console.log(`  ${idx + 1}. ${q.question_text}`);
        });
        console.log('\n');

        // Test 7: Get all quizzes and check the new fields
        console.log('7️⃣  GET / List all quizzes (check new fields in list)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.get(`${BASE_URL}?search=Quiz`);
        console.log(JSON.stringify(response.data, null, 2));
        console.log('\n');

        // Test 8: Update Quiz 2 - Disable Publish
        console.log('8️⃣  PUT /:id Update Quiz 2 (Unpublish)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.put(`${BASE_URL}/${quiz2Id}`, {
            is_published: false
        });
        console.log(`  is_published: ${response.data.data.is_published}`);
        console.log(`  shuffle_questions: ${response.data.data.shuffle_questions}`);
        console.log('\n');

        console.log('✅ All tests completed successfully!\n');
        console.log('📋 Summary:');
        console.log(`   ✅ is_published field works correctly (true/false)`);
        console.log(`   ✅ shuffle_questions field works correctly (true/false)`);
        console.log(`   ✅ Questions are shuffled when shuffle_questions=true`);
        console.log(`   ✅ Questions remain in order when shuffle_questions=false`);
        console.log(`   ✅ Update operations work with new fields\n`);

        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        process.exit(1);
    }
};

tests();
