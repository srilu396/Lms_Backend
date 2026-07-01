const tutorPortalService = require('../services/tutor-portal.service');

class TutorPortalController {


    // GET /tutor-portal/stats
    // Returns the 4 overview card values for the tutor dashboard
    async getStats(req, res, next) {
        try {
            const stats = await tutorPortalService.getStatsData(req.tutorId);

            res.status(200).json({
                success: true,
                message: 'Tutor stats retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/dashboard
    // Returns paginated, filterable batch list for the tutor's Batch Management table
    async getDashboard(req, res, next) {
        try {
            const { page, limit, search, status } = req.query;

            const dashboardData = await tutorPortalService.getDashboardData(req.tutorId, {
                page,
                limit,
                search,
                status
            });

            res.status(200).json({
                success: true,
                message: 'Tutor dashboard retrieved successfully',
                data: dashboardData
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/batch/:batchId/course
    // Returns the nested course structure (Modules→Topics→Lessons) for a batch
    async getBatchCourse(req, res, next) {
        try {
            const { batchId } = req.params;
            const courseData = await tutorPortalService.getBatchCourseStructure(
                batchId,
                req.tutorId,
                req.user.role
            );

            res.status(200).json({
                success: true,
                message: 'Batch course structure retrieved successfully',
                data: courseData
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/batch/:batchId/attendance-stats
    // Returns attendance statistics (Total, Present, Absent, Late)
    async getAttendanceStats(req, res, next) {
        try {
            const { batchId } = req.params;
            const { date } = req.query;

            const stats = await tutorPortalService.getBatchAttendanceStats(
                req.tutorId,
                batchId,
                { date }
            );

            res.status(200).json({
                success: true,
                message: 'Batch attendance stats retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/batch/:batchId/students
    // Returns paginated student list for attendance tagging
    async getBatchStudents(req, res, next) {
        try {
            const { batchId } = req.params;
            const { date, page, limit, search, status } = req.query;

            const studentData = await tutorPortalService.getBatchStudentsForAttendance(
                req.tutorId,
                batchId,
                { date, page, limit, search, status }
            );

            res.status(200).json({
                success: true,
                message: 'Batch students for attendance retrieved successfully',
                data: studentData
            });
        } catch (error) {
            next(error);
        }
    }

    // POST /tutor-portal/batch/:batchId/attendance
    // Logic to mark or update attendance for students in a batch
    async markAttendance(req, res, next) {
        try {
            const { batchId } = req.params;
            const attendanceData = await tutorPortalService.markBatchAttendance(
                req.tutorId,
                batchId,
                req.body
            );

            res.status(200).json({
                success: true,
                message: 'Attendance marked successfully',
                data: attendanceData
            });
        } catch (error) {
            next(error);
        }
    }

    // --------------------------------------------------
    // QUIZ MODULE
    // --------------------------------------------------

    // GET /tutor-portal/quizzes/stats
    async getQuizStats(req, res, next) {
        try {
            const stats = await tutorPortalService.getQuizStats(req.tutorId);
            res.status(200).json({
                success: true,
                message: 'Global quiz stats retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/quizzes
    async getQuizzesOverview(req, res, next) {
        try {
            const { page, limit, search } = req.query;
            const data = await tutorPortalService.getQuizzesOverview(req.tutorId, { page, limit, search });
            res.status(200).json({
                success: true,
                message: 'Quizzes overview retrieved successfully',
                data: data.data,
                pagination: data.pagination
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/batch/:batchId/quiz-stats
    async getBatchQuizStats(req, res, next) {
        try {
            const { batchId } = req.params;
            const stats = await tutorPortalService.getBatchQuizStats(req.tutorId, batchId);
            res.status(200).json({
                success: true,
                message: 'Batch quiz stats retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/batch/:batchId/quizzes
    async getBatchStudentQuizzes(req, res, next) {
        try {
            const { batchId } = req.params;
            const { page, limit, search, status } = req.query;
            const data = await tutorPortalService.getBatchStudentQuizzes(req.tutorId, batchId, { page, limit, search, status });
            res.status(200).json({
                success: true,
                message: 'Batch student quizzes retrieved successfully',
                data: data.data,
                pagination: data.pagination
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/quiz/:quizId/submission/:studentId
    // GET /tutor-portal/batch/:batchId/quiz/:quizId/submission/:studentId
    async getQuizReview(req, res, next) {
        try {
            const { quizId, studentId, batchId } = req.params;
            const reviewData = await tutorPortalService.getQuizSubmissionReview(
                req.tutorId,
                quizId,
                studentId,
                batchId
            );

            res.status(200).json({
                success: true,
                message: 'Quiz submission review data retrieved successfully',
                data: reviewData
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/quiz/:quizId/submission/:studentId/download
    // GET /tutor-portal/batch/:batchId/quiz/:quizId/submission/:studentId/download
    async downloadQuizReviewPDF(req, res, next) {
        try {
            const { quizId, studentId, batchId } = req.params;
            const reviewData = await tutorPortalService.getQuizSubmissionReview(
                req.tutorId,
                quizId,
                studentId,
                batchId
            );

            const PDFDocument = require('pdfkit');
            const doc = new PDFDocument({ margin: 50, bufferPages: true });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=quiz_review_${studentId}_${quizId}.pdf`);

            doc.pipe(res);

            // Styling variables
            const primaryColor = '#0f172a'; // Deep slate
            const accentColor = '#2563eb';  // Royal blue
            const successColor = '#10b981'; // Emerald green
            const dangerColor = '#ef4444';  // Red
            const textColor = '#334155';    // Medium slate text
            const textLight = '#64748b';    // Light slate text
            const lightGrey = '#f8fafc';    // Slate 50
            const borderColor = '#e2e8f0';  // Slate 200

            // Top header bar
            doc.rect(0, 0, 612, 12).fill(primaryColor);
            doc.y = 35;

            // Report Title
            doc.fillColor(primaryColor).fontSize(20).text('QUIZ SUBMISSION REPORT', { characterSpacing: 1, bold: true });
            doc.moveDown(0.2);
            doc.strokeColor(borderColor).lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
            doc.moveDown(0.8);

            // Metadata Columns (2-column layout)
            const metaY = doc.y;
            
            // Left Column (Student Details)
            doc.fillColor(textLight).fontSize(9).text('STUDENT DETAILS', 50, metaY);
            doc.fillColor(primaryColor).fontSize(12).text(reviewData.student.name, 50, metaY + 15, { bold: true });
            doc.fillColor(textColor).fontSize(10).text(reviewData.student.email, 50, metaY + 32);

            // Right Column (Quiz Details)
            doc.fillColor(textLight).fontSize(9).text('QUIZ & SUBMISSION DETAILS', 300, metaY);
            doc.fillColor(primaryColor).fontSize(12).text(reviewData.quiz.title, 300, metaY + 15, { bold: true });
            doc.fillColor(textColor).fontSize(10).text(`Submitted: ${reviewData.summary.submitted_at}`, 300, metaY + 32);

            doc.y = metaY + 60;
            doc.moveDown(1.5);

            // Summary metrics grid banner (Rounded box)
            const summaryY = doc.y;
            doc.roundedRect(50, summaryY, 512, 70, 6).fill(lightGrey);
            doc.roundedRect(50, summaryY, 512, 70, 6).lineWidth(1).stroke(borderColor);

            // Score Column
            doc.fillColor(textLight).fontSize(8).text('SCORE OBTAINED', 70, summaryY + 15);
            doc.fillColor(accentColor).fontSize(18).text(reviewData.summary.score, 70, summaryY + 28, { bold: true });

            // Correct Ratio Column
            doc.fillColor(textLight).fontSize(8).text('ACCURACY', 200, summaryY + 15);
            doc.fillColor(textColor).fontSize(15).text(reviewData.summary.correct_answers, 200, summaryY + 30, { bold: true });

            // Time Taken Column
            doc.fillColor(textLight).fontSize(8).text('TIME TAKEN', 330, summaryY + 15);
            doc.fillColor(textColor).fontSize(15).text(reviewData.summary.time_taken, 330, summaryY + 30, { bold: true });

            // Final Grade Status Column
            doc.fillColor(textLight).fontSize(8).text('RESULT', 450, summaryY + 15);
            const isPass = reviewData.summary.final_grade === 'PASS';
            const badgeColor = isPass ? successColor : dangerColor;
            doc.roundedRect(450, summaryY + 28, 65, 20, 4).fill(badgeColor);
            doc.fillColor('#ffffff').fontSize(10).text(reviewData.summary.final_grade, 450, summaryY + 33, { width: 65, align: 'center', bold: true });

            doc.y = summaryY + 95;

            // Section Header
            doc.fillColor(primaryColor).fontSize(13).text('Questions & Answers Detail', { bold: true });
            doc.moveDown(0.5);
            doc.strokeColor(borderColor).lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
            doc.moveDown(0.8);

            // Questions loop
            reviewData.questions.forEach((q) => {
                // Approximate question box height based on number of options
                const optionCount = q.options ? q.options.length : 0;
                const estimatedHeight = 60 + (optionCount * 20);

                // Page break check
                if (doc.y + estimatedHeight > 740) {
                    doc.addPage();
                    // Add header spacer for new page
                    doc.rect(0, 0, 612, 10).fill(primaryColor);
                    doc.y = 40;
                }

                const questionTopY = doc.y;

                // Draw a beautiful thin background card for the question
                doc.roundedRect(50, questionTopY, 512, estimatedHeight, 4).fill('#ffffff');
                doc.roundedRect(50, questionTopY, 512, estimatedHeight, 4).lineWidth(1).stroke(borderColor);

                // Draw left colored accent line based on correctness
                const correctnessColor = q.is_correct ? successColor : dangerColor;
                doc.rect(50, questionTopY, 4, estimatedHeight).fill(correctnessColor);

                // Print Question text
                doc.fillColor(primaryColor).fontSize(10).text(
                    `Question ${q.number}: ${q.question_text}`, 
                    65, 
                    questionTopY + 12, 
                    { width: 480, bold: true }
                );

                let currentOptionY = questionTopY + 34;

                if (q.options && Array.isArray(q.options)) {
                    q.options.forEach((opt) => {
                        const isStudentChoice = opt === q.student_choice;
                        const isCorrectAnswer = opt === q.correct_answer;

                        let bullet = '[ ] ';
                        let optColor = textColor;
                        let isBold = false;

                        if (isStudentChoice && isCorrectAnswer) {
                            bullet = '[✓] ';
                            optColor = successColor;
                            isBold = true;
                        } else if (isStudentChoice && !isCorrectAnswer) {
                            bullet = '[✗] ';
                            optColor = dangerColor;
                            isBold = true;
                        } else if (isCorrectAnswer) {
                            bullet = '[✓] ';
                            optColor = successColor;
                            isBold = true;
                        }

                        doc.fillColor(optColor).fontSize(9).text(
                            `${bullet}${opt}`,
                            75,
                            currentOptionY,
                            { width: 460, bold: isBold }
                        );
                        currentOptionY += 18;
                    });
                } else {
                    // Open-ended type questions
                    const isCorrect = q.is_correct;
                    doc.fillColor(textColor).fontSize(9).text(
                        `Student Answer: ${q.student_choice || 'N/A'}`,
                        75,
                        currentOptionY
                    );
                    doc.fillColor(successColor).fontSize(9).text(
                        `Correct Answer: ${q.correct_answer || 'N/A'}`,
                        75,
                        currentOptionY + 15,
                        { bold: true }
                    );
                    currentOptionY += 32;
                }

                // Spacing after each card
                doc.y = questionTopY + estimatedHeight + 15;
            });

            // Dynamic Page Numbering & Footer
            const range = doc.bufferedPageRange();
            for (let i = 0; i < range.count; i++) {
                doc.switchToPage(i);
                
                // Footer divider line
                doc.strokeColor(borderColor).lineWidth(1).moveTo(50, 745).lineTo(562, 745).stroke();
                
                // Footer Brand / Info
                doc.fillColor(textLight).fontSize(8).text(
                    'LMS Tutor Portal • Automatically Generated Report',
                    50,
                    755
                );
                
                // Page Number
                doc.fillColor(textLight).fontSize(8).text(
                    `Page ${i + 1} of ${range.count}`,
                    50,
                    755,
                    { align: 'right' }
                );
            }

            doc.end();
        } catch (error) {
            next(error);
        }
    }

    // --------------------------------------------------
    // ASSIGNMENT MODULE
    // --------------------------------------------------

    // GET /tutor-portal/assignments/stats
    async getAssignmentStats(req, res, next) {
        try {
            const stats = await tutorPortalService.getAssignmentStats(req.tutorId);
            res.status(200).json({
                success: true,
                message: 'Global assignment stats retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/assignments
    async getAssignmentsOverview(req, res, next) {
        try {
            const { page, limit, search } = req.query;
            const data = await tutorPortalService.getAssignmentsOverview(req.tutorId, { page, limit, search });
            res.status(200).json({
                success: true,
                message: 'Assignments overview retrieved successfully',
                data: data.data,
                pagination: data.pagination
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/batch/:batchId/assignment-stats
    async getBatchAssignmentStats(req, res, next) {
        try {
            const { batchId } = req.params;
            const stats = await tutorPortalService.getBatchAssignmentStats(req.tutorId, batchId);
            res.status(200).json({
                success: true,
                message: 'Batch assignment stats retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/batch/:batchId/assignments
    async getBatchStudentAssignments(req, res, next) {
        try {
            const { batchId } = req.params;
            const { page, limit, search, status } = req.query;
            const data = await tutorPortalService.getBatchStudentAssignments(req.tutorId, batchId, { page, limit, search, status });
            res.status(200).json({
                success: true,
                message: 'Batch student assignments retrieved successfully',
                data: data.data,
                pagination: data.pagination
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/assignment/:assignmentId/submission/:studentId
    // GET /tutor-portal/batch/:batchId/assignment/:assignmentId/submission/:studentId
    async getAssignmentReview(req, res, next) {
        try {
            const { assignmentId, studentId, batchId } = req.params;
            const data = await tutorPortalService.getAssignmentSubmissionReview(
                req.tutorId,
                assignmentId,
                studentId,
                batchId
            );
            res.status(200).json({
                success: true,
                message: 'Assignment submission review data retrieved successfully',
                data
            });
        } catch (error) {
            next(error);
        }
    }

    // POST /tutor-portal/assignment/:assignmentId/submission/:studentId/evaluate
    // POST /tutor-portal/batch/:batchId/assignment/:assignmentId/submission/:studentId/evaluate
    async evaluateAssignmentSubmission(req, res, next) {
        try {
            const { assignmentId, studentId, batchId } = req.params;
            const data = await tutorPortalService.evaluateAssignmentSubmission(
                req.tutorId,
                assignmentId,
                studentId,
                batchId,
                req.body
            );
            res.status(200).json({
                success: true,
                message: req.body.is_draft ? 'Draft evaluation saved successfully' : 'Assignment evaluated successfully',
                data
            });
        } catch (error) {
            next(error);
        }
    }
}


module.exports = new TutorPortalController();
