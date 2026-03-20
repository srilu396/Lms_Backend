const { Quiz, QuizQuestion } = require('../models');
const { Op } = require('sequelize');

// Shuffle utility function
const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

class QuizService {
    async getQuizStats() {
        const totalQuizzes = await Quiz.count();
        const activeQuizzes = await Quiz.count({ where: { status: 'published' } });
        const pendingQuizzes = await Quiz.count({ where: { status: 'draft' } });

        return {
            totalQuizzes,
            activeQuizzes,
            pendingQuizzes
        };
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    async getQuizzes(queryParams) {
        const { page = 1, rowsPerPage = 10, search, status, sortField = 'created_at', sortOrder = 'DESC' } = queryParams;
        
        const limit = parseInt(rowsPerPage);
        const offset = (parseInt(page) - 1) * limit;
        
        let whereClause = {};
        
        if (search) {
            whereClause.name = { [Op.iLike]: `%${search}%` };
        }
        
        if (status) {
            whereClause.status = status.toLowerCase();
        }

        const { count, rows } = await Quiz.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            order: [[sortField, sortOrder]],
            include: [{
                model: QuizQuestion,
                attributes: ['id']
            }],
            distinct: true
        });

        // Format data to match frontend expectations
        const data = rows.map(quiz => ({
            id: quiz.id,
            quiz_title: quiz.name,
            topic_id: quiz.topic_id,
            domain: quiz.domain || [],
            tags: quiz.tags || [],
            module: null, // As per requirements
            total_questions: quiz.QuizQuestions ? quiz.QuizQuestions.length : 0,
            status: quiz.status,
            time_limit_minutes: quiz.time_limit_minutes,
            total_marks: quiz.total_marks,
            passing_score: quiz.passing_score
        }));

        return {
            data,
            pagination: {
                total: count,
                page: parseInt(page),
                rowsPerPage: limit,
                totalPages: Math.ceil(count / limit)
            }
        };
    }

    async getQuizById(quizId) {
        const quiz = await Quiz.findByPk(quizId, {
            include: [{
                model: QuizQuestion,
                attributes: ['id', 'question_text', 'type', 'options', 'correct_answer', 'marks', 'order_num']
            }]
        });

        if (!quiz) {
            throw {
                statusCode: 404,
                message: 'Quiz not found'
            };
        }

        // Get questions
        let questions = quiz.QuizQuestions || [];
        
        // Shuffle questions if shuffle_questions is true
        if (quiz.shuffle_questions && questions.length > 0) {
            questions = this.shuffleArray([...questions]);
        }

        return {
            id: quiz.id,
            topic_id: quiz.topic_id,
            quiz_title: quiz.name,
            instructions: quiz.instructions,
            max_attempts: quiz.max_attempts,
            duration: quiz.time_limit_minutes,
            total_marks: quiz.total_marks,
            passing_score: quiz.passing_score,
            domain: quiz.domain,
            tags: quiz.tags,
            status: quiz.status,
            is_published: quiz.is_published,
            shuffle_questions: quiz.shuffle_questions,
            questions: questions
        };
    }

    async createQuiz(quizData) {
        const { quiz_title, instructions, max_attempts, duration, total_marks, passing_score, domain, tags, questions, status, topic_id, is_published, shuffle_questions } = quizData;

        // Validate required fields
        if (!quiz_title) {
            throw {
                statusCode: 400,
                message: 'Quiz title is required'
            };
        }

        if (!total_marks) {
            throw {
                statusCode: 400,
                message: 'Total marks is required'
            };
        }

        try {
            // Create the quiz
            const quiz = await Quiz.create({
                name: quiz_title,
                instructions: instructions || null,
                max_attempts: max_attempts || 1,
                time_limit_minutes: duration || null,
                total_marks,
                passing_score: passing_score || null,
                domain: Array.isArray(domain) ? domain : (domain ? [domain] : []),
                tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
                status: status || 'draft',
                is_published: is_published || false,
                shuffle_questions: shuffle_questions || false,
                topic_id: topic_id || null
            });

            // Add questions if provided
            if (questions && Array.isArray(questions) && questions.length > 0) {
                const quizQuestions = questions.map((q, index) => ({
                    quiz_id: quiz.id,
                    question_text: q.question_text,
                    type: q.type, // 'mcq' or 'true_false'
                    options: q.options || [],
                    correct_answer: q.correct_answer,
                    marks: q.marks || 1,
                    order_num: index + 1
                }));
                await QuizQuestion.bulkCreate(quizQuestions);
            }

            // Fetch and return the created quiz with questions
            const createdQuiz = await this.getQuizById(quiz.id);
            return createdQuiz;
        } catch (error) {
            throw {
                statusCode: 400,
                message: error.message || 'Error creating quiz'
            };
        }
    }

    async updateQuiz(quizId, updateData) {
        const { quiz_title, instructions, max_attempts, duration, total_marks, passing_score, domain, tags, questions, status, is_published, shuffle_questions, topic_id } = updateData;

        try {
            const quiz = await Quiz.findByPk(quizId);
            if (!quiz) {
                throw {
                    statusCode: 404,
                    message: 'Quiz not found'
                };
            }

            // Update basic fields
            if (quiz_title !== undefined) quiz.name = quiz_title;
            if (instructions !== undefined) quiz.instructions = instructions;
            if (max_attempts !== undefined) quiz.max_attempts = max_attempts;
            if (duration !== undefined) quiz.time_limit_minutes = duration;
            if (total_marks !== undefined) quiz.total_marks = total_marks;
            if (passing_score !== undefined) quiz.passing_score = passing_score;
            if (domain !== undefined) quiz.domain = Array.isArray(domain) ? domain : (domain ? [domain] : []);
            if (tags !== undefined) quiz.tags = Array.isArray(tags) ? tags : (tags ? [tags] : []);
            if (status !== undefined) quiz.status = status;
            if (is_published !== undefined) quiz.is_published = is_published;
            if (shuffle_questions !== undefined) quiz.shuffle_questions = shuffle_questions;
            if (topic_id !== undefined) quiz.topic_id = topic_id;

            await quiz.save();

            // Update questions if provided
            if (questions && Array.isArray(questions)) {
                // Delete existing questions
                await QuizQuestion.destroy({ where: { quiz_id: quizId } });

                // Add new questions
                const quizQuestions = questions.map((q, index) => ({
                    quiz_id: quizId,
                    question_text: q.question_text,
                    type: q.type,
                    options: q.options || [],
                    correct_answer: q.correct_answer,
                    marks: q.marks || 1,
                    order_num: index + 1
                }));
                await QuizQuestion.bulkCreate(quizQuestions);
            }

            const updatedQuiz = await this.getQuizById(quizId);
            return updatedQuiz;
        } catch (error) {
            throw {
                statusCode: error.statusCode || 400,
                message: error.message || 'Error updating quiz'
            };
        }
    }

    async deleteQuiz(quizId) {
        try {
            const quiz = await Quiz.findByPk(quizId);
            if (!quiz) {
                throw {
                    statusCode: 404,
                    message: 'Quiz not found'
                };
            }

            // Delete associated questions first
            await QuizQuestion.destroy({ where: { quiz_id: quizId } });

            // Delete the quiz
            await quiz.destroy();

            return { message: 'Quiz deleted successfully' };
        } catch (error) {
            throw {
                statusCode: error.statusCode || 400,
                message: error.message || 'Error deleting quiz'
            };
        }
    }

    // Utility function to shuffle array (Fisher-Yates shuffle algorithm)
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}

module.exports = new QuizService();
