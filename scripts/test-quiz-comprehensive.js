require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:8000/api/v1/quizzes';

const tests = async () => {
    try {
        console.log('\n================================');
        console.log('Testing Quiz API Endpoints');
        console.log('================================\n');

        // Test 1: Get Stats (empty)
        console.log('1️⃣  GET /stats (Initial)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        let response = await axios.get(`${BASE_URL}/stats`);
        console.log(JSON.stringify(response.data, null, 2));
        console.log('\n');

        // Test 2: Create Quiz 1
        console.log('2️⃣  POST / Create Quiz 1: Introduction to Algorithms');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.post(`${BASE_URL}`, {
            quiz_title: "Introduction to Algorithms",
            duration: 45,
            total_marks: 100,
            domain: ["Computer Science"],
            tags: ["ALGORITHMS", "BASICS"],
            status: "published",
            questions: [
                {
                    question_text: "What is the time complexity of Binary Search?",
                    type: "mcq",
                    options: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
                    correct_answer: "O(log n)",
                    marks: 50
                },
                {
                    question_text: "A Linked List allows constant time access to its elements by index.",
                    type: "true_false",
                    options: ["True", "False"],
                    correct_answer: "False",
                    marks: 50
                }
            ]
        });
        console.log(JSON.stringify(response.data, null, 2));
        const quiz1Id = response.data.data.id;
        console.log(`\n✅ Quiz 1 created with ID: ${quiz1Id}\n`);

        // Test 3: Create Quiz 2
        console.log('3️⃣  POST / Create Quiz 2: Data Structures Deep Dive');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.post(`${BASE_URL}`, {
            quiz_title: "Data Structures Deep Dive",
            duration: 60,
            total_marks: 150,
            domain: ["Computer Science"],
            tags: ["DATA_STRUCTURES", "ADVANCED"],
            status: "draft",
            questions: [
                {
                    question_text: "What is the time complexity of inserting at the beginning of a linked list?",
                    type: "mcq",
                    options: ["O(1)", "O(n)", "O(log n)", "O(n²)"],
                    correct_answer: "O(1)",
                    marks: 75
                },
                {
                    question_text: "Stacks follow the FIFO principle.",
                    type: "true_false",
                    options: ["True", "False"],
                    correct_answer: "False",
                    marks: 75
                }
            ]
        });
        console.log(JSON.stringify(response.data, null, 2));
        const quiz2Id = response.data.data.id;
        console.log(`\n✅ Quiz 2 created with ID: ${quiz2Id}\n`);

        // Test 4: Create Quiz 3
        console.log('4️⃣  POST / Create Quiz 3: Sorting Algorithms');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.post(`${BASE_URL}`, {
            quiz_title: "Sorting Algorithms",
            duration: 50,
            total_marks: 120,
            domain: ["Computer Science"],
            tags: ["SORTING", "INTERMEDIATE"],
            status: "scheduled",
            questions: [
                {
                    question_text: "Which sorting algorithm has the best average time complexity?",
                    type: "mcq",
                    options: ["Bubble Sort", "Quick Sort", "Selection Sort", "Insertion Sort"],
                    correct_answer: "Quick Sort",
                    marks: 60
                },
                {
                    question_text: "Merge Sort is an in-place sorting algorithm.",
                    type: "true_false",
                    options: ["True", "False"],
                    correct_answer: "False",
                    marks: 60
                }
            ]
        });
        console.log(JSON.stringify(response.data, null, 2));
        const quiz3Id = response.data.data.id;
        console.log(`\n✅ Quiz 3 created with ID: ${quiz3Id}\n`);

        // Test 5: Get Stats (with data)
        console.log('5️⃣  GET /stats (After creating quizzes)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.get(`${BASE_URL}/stats`);
        console.log(JSON.stringify(response.data, null, 2));
        console.log('\n');

        // Test 6: Get All Quizzes
        console.log('6️⃣  GET / List all quizzes');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.get(`${BASE_URL}?page=1&rowsPerPage=10`);
        console.log(JSON.stringify(response.data, null, 2));
        console.log('\n');

        // Test 7: Filter by status (published)
        console.log('7️⃣  GET / Filter by status=published');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.get(`${BASE_URL}?status=published`);
        console.log(JSON.stringify(response.data, null, 2));
        console.log('\n');

        // Test 8: Filter by status (draft)
        console.log('8️⃣  GET / Filter by status=draft');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.get(`${BASE_URL}?status=draft`);
        console.log(JSON.stringify(response.data, null, 2));
        console.log('\n');

        // Test 9: Search
        console.log('9️⃣  GET / Search for "algorithms"');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.get(`${BASE_URL}?search=algorithms`);
        console.log(JSON.stringify(response.data, null, 2));
        console.log('\n');

        // Test 10: Get Single Quiz (Finalized view)
        console.log(`🔟 GET /${quiz1Id} Get single quiz with all questions`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.get(`${BASE_URL}/${quiz1Id}`);
        console.log(JSON.stringify(response.data, null, 2));
        console.log('\n');

        // Test 11: Update Quiz
        console.log(`1️⃣1️⃣ PUT /${quiz1Id} Update Quiz 1`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.put(`${BASE_URL}/${quiz1Id}`, {
            quiz_title: "Introduction to Algorithms (UPDATED)",
            duration: 50,
            total_marks: 110,
            status: "draft"
        });
        console.log(JSON.stringify(response.data, null, 2));
        console.log('\n');

        // Test 12: Verify Update
        console.log(`1️⃣2️⃣ GET /${quiz1Id} Verify updated quiz`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.get(`${BASE_URL}/${quiz1Id}`);
        console.log(JSON.stringify(response.data, null, 2));
        console.log('\n');

        // Test 13: Delete Quiz
        console.log(`1️⃣3️⃣ DELETE /${quiz3Id} Delete Quiz 3`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.delete(`${BASE_URL}/${quiz3Id}`);
        console.log(JSON.stringify(response.data, null, 2));
        console.log('\n');

        // Test 14: Verify Deletion
        console.log(`1️⃣4️⃣ GET /${quiz3Id} Verify deletion (should be 404)`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        try {
            response = await axios.get(`${BASE_URL}/${quiz3Id}`);
        } catch (error) {
            console.log(JSON.stringify({
                status: error.response.status,
                data: error.response.data
            }, null, 2));
        }
        console.log('\n');

        // Test 15: Final Stats
        console.log('1️⃣5️⃣ GET /stats Final count');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        response = await axios.get(`${BASE_URL}/stats`);
        console.log(JSON.stringify(response.data, null, 2));
        console.log('\n');

        console.log('✅ All tests completed successfully!\n');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        process.exit(1);
    }
};

tests();
