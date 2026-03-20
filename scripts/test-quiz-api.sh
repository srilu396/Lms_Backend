#!/bin/bash

# Wait for server to be ready
sleep 3

echo "================================"
echo "Testing Quiz API Endpoints"
echo "================================"
echo ""

# 1. Test Stats Endpoint
echo "1️⃣ Testing GET /api/v1/quizzes/stats"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X GET http://localhost:8000/api/v1/quizzes/stats | jq . || echo "Error connecting"
echo ""
echo ""

# 2. Test Get All Quizzes (empty)
echo "2️⃣ Testing GET /api/v1/quizzes (before creating any)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X GET "http://localhost:8000/api/v1/quizzes?page=1&rowsPerPage=10" | jq . || echo "Error connecting"
echo ""
echo ""

# 3. Create Quiz 1
echo "3️⃣ Creating Quiz 1: Introduction to Algorithms"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
QUIZ_1=$(curl -s -X POST http://localhost:8000/api/v1/quizzes \
  -H "Content-Type: application/json" \
  -d '{
    "quiz_title": "Introduction to Algorithms",
    "duration": 45,
    "total_marks": 100,
    "domain": ["Computer Science"],
    "tags": ["ALGORITHMS", "BASICS"],
    "status": "published",
    "topic_id": 1,
    "questions": [
      {
        "question_text": "What is the time complexity of Binary Search?",
        "type": "mcq",
        "options": ["O(n)", "O(log n)", "O(n²)", "O(1)"],
        "correct_answer": "O(log n)",
        "marks": 50
      },
      {
        "question_text": "A Linked List allows constant time access to its elements by index.",
        "type": "true_false",
        "options": ["True", "False"],
        "correct_answer": "False",
        "marks": 50
      }
    ]
  }')
echo "$QUIZ_1" | jq .
QUIZ_1_ID=$(echo "$QUIZ_1" | jq -r '.data.id // empty')
echo "Quiz 1 ID: $QUIZ_1_ID"
echo ""
echo ""

# 4. Create Quiz 2
echo "4️⃣ Creating Quiz 2: Data Structures Deep Dive"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
QUIZ_2=$(curl -s -X POST http://localhost:8000/api/v1/quizzes \
  -H "Content-Type: application/json" \
  -d '{
    "quiz_title": "Data Structures Deep Dive",
    "duration": 60,
    "total_marks": 150,
    "domain": ["Computer Science"],
    "tags": ["DATA_STRUCTURES", "ADVANCED"],
    "status": "draft",
    "topic_id": 1,
    "questions": [
      {
        "question_text": "What is the time complexity of inserting at the beginning of a linked list?",
        "type": "mcq",
        "options": ["O(1)", "O(n)", "O(log n)", "O(n²)"],
        "correct_answer": "O(1)",
        "marks": 75
      },
      {
        "question_text": "Stacks follow the FIFO principle.",
        "type": "true_false",
        "options": ["True", "False"],
        "correct_answer": "False",
        "marks": 75
      }
    ]
  }')
echo "$QUIZ_2" | jq .
QUIZ_2_ID=$(echo "$QUIZ_2" | jq -r '.data.id // empty')
echo "Quiz 2 ID: $QUIZ_2_ID"
echo ""
echo ""

# 5. Create Quiz 3 (Scheduled)
echo "5️⃣ Creating Quiz 3: Sorting Algorithms"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
QUIZ_3=$(curl -s -X POST http://localhost:8000/api/v1/quizzes \
  -H "Content-Type: application/json" \
  -d '{
    "quiz_title": "Sorting Algorithms",
    "duration": 50,
    "total_marks": 120,
    "domain": ["Computer Science"],
    "tags": ["SORTING", "INTERMEDIATE"],
    "status": "scheduled",
    "topic_id": 1,
    "questions": [
      {
        "question_text": "Which sorting algorithm has the best average time complexity?",
        "type": "mcq",
        "options": ["Bubble Sort", "Quick Sort", "Selection Sort", "Insertion Sort"],
        "correct_answer": "Quick Sort",
        "marks": 60
      },
      {
        "question_text": "Merge Sort is an in-place sorting algorithm.",
        "type": "true_false",
        "options": ["True", "False"],
        "correct_answer": "False",
        "marks": 60
      }
    ]
  }')
echo "$QUIZ_3" | jq .
QUIZ_3_ID=$(echo "$QUIZ_3" | jq -r '.data.id // empty')
echo "Quiz 3 ID: $QUIZ_3_ID"
echo ""
echo ""

# 6. Test Stats Again
echo "6️⃣ Testing GET /api/v1/quizzes/stats (after creating quizzes)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X GET http://localhost:8000/api/v1/quizzes/stats | jq .
echo ""
echo ""

# 7. Get All Quizzes (with data)
echo "7️⃣ Testing GET /api/v1/quizzes (list all)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X GET "http://localhost:8000/api/v1/quizzes?page=1&rowsPerPage=10" | jq .
echo ""
echo ""

# 8. Get Quizzes by Status Filter (published)
echo "8️⃣ Testing GET /api/v1/quizzes?status=published"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X GET "http://localhost:8000/api/v1/quizzes?status=published" | jq .
echo ""
echo ""

# 9. Get Quizzes by Status Filter (draft)
echo "9️⃣ Testing GET /api/v1/quizzes?status=draft"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X GET "http://localhost:8000/api/v1/quizzes?status=draft" | jq .
echo ""
echo ""

# 10. Search Quizzes
echo "🔟 Testing GET /api/v1/quizzes?search=algorithms"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X GET "http://localhost:8000/api/v1/quizzes?search=algorithms" | jq .
echo ""
echo ""

# 11. Get Single Quiz by ID (if we have it)
if [ -n "$QUIZ_1_ID" ] && [ "$QUIZ_1_ID" != "null" ]; then
  echo "1️⃣1️⃣ Testing GET /api/v1/quizzes/$QUIZ_1_ID"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  curl -s -X GET "http://localhost:8000/api/v1/quizzes/$QUIZ_1_ID" | jq .
  echo ""
  echo ""

  # 12. Update Quiz
  echo "1️⃣2️⃣ Testing PUT /api/v1/quizzes/$QUIZ_1_ID (Update)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  curl -s -X PUT "http://localhost:8000/api/v1/quizzes/$QUIZ_1_ID" \
    -H "Content-Type: application/json" \
    -d '{
      "quiz_title": "Introduction to Algorithms (UPDATED)",
      "duration": 50,
      "total_marks": 110,
      "status": "draft"
    }' | jq .
  echo ""
  echo ""

  # 13. Get updated quiz
  echo "1️⃣3️⃣ Testing GET /api/v1/quizzes/$QUIZ_1_ID (After Update)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  curl -s -X GET "http://localhost:8000/api/v1/quizzes/$QUIZ_1_ID" | jq .
  echo ""
  echo ""
fi

# 14. Delete a Quiz
if [ -n "$QUIZ_3_ID" ] && [ "$QUIZ_3_ID" != "null" ]; then
  echo "1️⃣4️⃣ Testing DELETE /api/v1/quizzes/$QUIZ_3_ID"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  curl -s -X DELETE "http://localhost:8000/api/v1/quizzes/$QUIZ_3_ID" | jq .
  echo ""
  echo ""

  # 15. Verify deletion
  echo "1️⃣5️⃣ Testing GET /api/v1/quizzes/$QUIZ_3_ID (Should return 404)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  curl -s -X GET "http://localhost:8000/api/v1/quizzes/$QUIZ_3_ID" | jq .
  echo ""
  echo ""
fi

# Final Stats
echo "1️⃣6️⃣ Final GET /api/v1/quizzes/stats"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X GET http://localhost:8000/api/v1/quizzes/stats | jq .
echo ""
echo ""

echo "✅ All tests completed!"
