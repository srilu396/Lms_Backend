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

    async getQuizLookup(query = {}) {
        const { search, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);

        const where = {
            status: 'published'
        };

        if (search) {
            where.name = { [Op.iLike]: `%${search.trim()}%` };
        }

        const rows = await Quiz.findAll({
            where,
            limit: parsedLimit,
            attributes: ['id', 'name'],
            order: [['name', 'ASC']]
        });

        return {
            data: rows
        };
    }

    validateQuizPayload(quizData) {
        const { quiz_title, total_marks, passing_score, questions } = quizData;

        if (!quiz_title || typeof quiz_title !== 'string' || !quiz_title.trim()) {
            throw {
                statusCode: 400,
                message: 'Quiz title is required'
            };
        }

        if (total_marks === undefined || total_marks === null || total_marks === '') {
            throw {
                statusCode: 400,
                message: 'Total marks is required'
            };
        }

        const totalMarksNum = Number(total_marks);
        if (isNaN(totalMarksNum) || !Number.isInteger(totalMarksNum) || totalMarksNum <= 0) {
            throw {
                statusCode: 400,
                message: 'Total marks must be a positive integer greater than 0'
            };
        }

        if (passing_score !== undefined && passing_score !== null && passing_score !== '') {
            const passingNum = Number(passing_score);
            if (isNaN(passingNum) || !Number.isInteger(passingNum) || passingNum <= 0) {
                throw {
                    statusCode: 400,
                    message: 'Passing score must be a positive integer'
                };
            }
            if (passingNum > totalMarksNum) {
                throw {
                    statusCode: 400,
                    message: 'Passing score cannot exceed total marks'
                };
            }
        }

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            throw {
                statusCode: 400,
                message: 'Questions array is required and cannot be empty'
            };
        }

        let sumMarks = 0;

        questions.forEach((q, index) => {
            const qNum = index + 1;
            const qText = q.question_text || q.question;

            if (!qText || typeof qText !== 'string' || !qText.trim()) {
                throw {
                    statusCode: 400,
                    message: `Question ${qNum} text is required`
                };
            }

            if (!q.options || !Array.isArray(q.options) || q.options.length === 0) {
                throw {
                    statusCode: 400,
                    message: `Question ${qNum} must have valid options`
                };
            }

            if (q.correct_answer === undefined || q.correct_answer === null || q.correct_answer === '') {
                throw {
                    statusCode: 400,
                    message: `Question ${qNum} must have a correct answer`
                };
            }

            if (q.marks === undefined || q.marks === null || q.marks === '' || typeof q.marks === 'boolean') {
                throw {
                    statusCode: 400,
                    message: `Question ${qNum} must have a valid positive marks value greater than 0`
                };
            }

            const marksNum = Number(q.marks);
            if (isNaN(marksNum) || !Number.isInteger(marksNum) || marksNum <= 0) {
                throw {
                    statusCode: 400,
                    message: `Question ${qNum} marks must be a positive integer`
                };
            }

            sumMarks += marksNum;
        });

        if (sumMarks !== totalMarksNum) {
            throw {
                statusCode: 400,
                message: `The total of all question marks (${sumMarks}) must equal the quiz total marks (${totalMarksNum})`
            };
        }
    }

    async getQuizById(quizId) {
        const quiz = await Quiz.findByPk(quizId, {
            include: [{
                model: QuizQuestion,
                attributes: ['id', 'question_text', 'type', 'options', 'correct_answer', 'marks', 'order_num']
            }],
            order: [[QuizQuestion, 'order_num', 'ASC']]
        });

        if (!quiz) {
            throw {
                statusCode: 404,
                message: 'Quiz not found'
            };
        }

        const questions = quiz.QuizQuestions || [];

        return {
            id: quiz.id,
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
        const { quiz_title, instructions, max_attempts, duration, total_marks, passing_score, domain, tags, questions, status, is_published, shuffle_questions, shuffle } = quizData;

        // Validate required fields and marks logic
        this.validateQuizPayload(quizData);

        const existingQuiz = await Quiz.findOne({ where: { name: { [Op.iLike]: quiz_title.trim() } } });
        if (existingQuiz) {
            throw {
                statusCode: 400,
                message: 'A quiz with this title already exists'
            };
        }

        const shuffleVal = shuffle_questions !== undefined ? Boolean(shuffle_questions) : (shuffle !== undefined ? Boolean(shuffle) : false);

        try {
            // Create the quiz
            const quiz = await Quiz.create({
                name: quiz_title.trim(),
                instructions: instructions || null,
                max_attempts: max_attempts || 1,
                time_limit_minutes: duration || null,
                total_marks: Number(total_marks),
                passing_score: passing_score ? Number(passing_score) : null,
                domain: Array.isArray(domain) ? domain : (domain ? [domain] : []),
                tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
                status: status || 'draft',
                is_published: is_published || false,
                shuffle_questions: shuffleVal
            });

            // Add questions
            const quizQuestions = questions.map((q, index) => ({
                quiz_id: quiz.id,
                question_text: q.question_text || q.question,
                type: q.type || 'mcq',
                options: q.options || [],
                correct_answer: String(q.correct_answer),
                marks: Number(q.marks),
                order_num: index + 1
            }));
            await QuizQuestion.bulkCreate(quizQuestions);

            // Fetch and return the created quiz with questions
            return await this.getQuizById(quiz.id);
        } catch (error) {
            throw {
                statusCode: error.statusCode || 400,
                message: error.message || 'Error creating quiz'
            };
        }
    }

    async updateQuiz(quizId, updateData) {
        try {
            const quiz = await Quiz.findByPk(quizId, {
                include: [{ model: QuizQuestion }]
            });
            if (!quiz) {
                throw {
                    statusCode: 404,
                    message: 'Quiz not found'
                };
            }

            if (updateData.quiz_title && updateData.quiz_title.trim().toLowerCase() !== quiz.name.toLowerCase()) {
                const existingQuiz = await Quiz.findOne({ where: { name: { [Op.iLike]: updateData.quiz_title.trim() } } });
                if (existingQuiz && existingQuiz.id !== quiz.id) {
                    throw {
                        statusCode: 400,
                        message: 'A quiz with this title already exists'
                    };
                }
            }

            const effectivePayload = {
                quiz_title: updateData.quiz_title !== undefined ? updateData.quiz_title : quiz.name,
                total_marks: updateData.total_marks !== undefined ? updateData.total_marks : quiz.total_marks,
                passing_score: updateData.passing_score !== undefined ? updateData.passing_score : quiz.passing_score,
                questions: updateData.questions !== undefined ? updateData.questions : (quiz.QuizQuestions || [])
            };

            this.validateQuizPayload(effectivePayload);

            const { quiz_title, instructions, max_attempts, duration, total_marks, passing_score, domain, tags, questions, status, is_published, shuffle_questions, shuffle } = updateData;

            if (quiz_title !== undefined) quiz.name = quiz_title.trim();
            if (instructions !== undefined) quiz.instructions = instructions;
            if (max_attempts !== undefined) quiz.max_attempts = max_attempts;
            if (duration !== undefined) quiz.time_limit_minutes = duration;
            if (total_marks !== undefined) quiz.total_marks = Number(total_marks);
            if (passing_score !== undefined) quiz.passing_score = passing_score ? Number(passing_score) : null;
            if (domain !== undefined) quiz.domain = Array.isArray(domain) ? domain : (domain ? [domain] : []);
            if (tags !== undefined) quiz.tags = Array.isArray(tags) ? tags : (tags ? [tags] : []);
            if (status !== undefined) quiz.status = status;
            if (is_published !== undefined) quiz.is_published = is_published;
            if (shuffle_questions !== undefined) quiz.shuffle_questions = Boolean(shuffle_questions);
            else if (shuffle !== undefined) quiz.shuffle_questions = Boolean(shuffle);

            await quiz.save();

            if (questions && Array.isArray(questions)) {
                await QuizQuestion.destroy({ where: { quiz_id: quizId } });

                const quizQuestions = questions.map((q, index) => ({
                    quiz_id: quizId,
                    question_text: q.question_text || q.question,
                    type: q.type || 'mcq',
                    options: q.options || [],
                    correct_answer: String(q.correct_answer),
                    marks: Number(q.marks),
                    order_num: index + 1
                }));
                await QuizQuestion.bulkCreate(quizQuestions);
            }

            return await this.getQuizById(quizId);
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

    async unlinkQuiz(quizId, updateField) {
        try {
            const quiz = await Quiz.findByPk(quizId);
            if (!quiz) {
                throw {
                    statusCode: 404,
                    message: 'Quiz not found'
                };
            }
            await quiz.update(updateField);
            return true;
        } catch (error) {
            throw {
                statusCode: error.statusCode || 400,
                message: error.message || 'Error unlinking quiz'
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
