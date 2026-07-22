const { Institution, Course, Tutor, Student, sequelize } = require('../../models');
const { Op } = require('sequelize');

class EntityResolver {
    constructor(defaultInstitutionId = null) {
        this.defaultInstitutionId = defaultInstitutionId;
        this.institutions = new Map();
        this.courses = new Map();
        this.instructors = new Map();
        this.students = new Map(); 
    }

    async resolveAll(rows, errorBuilder) {
        const instNames = new Set();
        const courseNames = new Set();
        const instrNames = new Set();
        const studentNames = new Set();

        rows.forEach(row => {
            if (row.institution) instNames.add(row.institution.toLowerCase());
            if (row.course) courseNames.add(row.course.toLowerCase());
            if (row.instructor) instrNames.add(row.instructor.toLowerCase());
            if (row.enroll_students) {
                const names = row.enroll_students.split(',').map(n => n.trim().toLowerCase()).filter(n => n);
                names.forEach(n => studentNames.add(n));
            }
        });

        // Resolve Institutions
        let insts = [];
        if (instNames.size > 0) {
            insts = await Institution.findAll({ 
                where: { 
                    [Op.and]: [
                        sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), { [Op.in]: Array.from(instNames) }),
                        { is_active: true }
                    ]
                } 
            });
            this._buildMap(insts, this.institutions, 'name');
        }

        if (this.defaultInstitutionId && !this.institutions.has(this.defaultInstitutionId.toString())) {
             const defInst = await Institution.findByPk(this.defaultInstitutionId);
             if (defInst) {
                  this.institutions.set(defInst.id.toString(), [defInst]); 
             }
        }

        // Resolve Courses
        if (courseNames.size > 0) {
            const crs = await Course.findAll({ 
                where: { 
                    [Op.and]: [
                        sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), { [Op.in]: Array.from(courseNames) }),
                        { status: 'active' }
                    ]
                } 
            });
            this._buildMap(crs, this.courses, 'name');
        }

        // Resolve Instructors
        if (instrNames.size > 0) {
            const tuts = await Tutor.findAll({ 
                where: { 
                    [Op.and]: [
                        sequelize.where(sequelize.fn('LOWER', sequelize.col('full_name')), { [Op.in]: Array.from(instrNames) }),
                        { status: 'active' }
                    ]
                } 
            });
            this._buildMap(tuts, this.instructors, 'full_name');
        }

        // Resolve Students
        if (studentNames.size > 0) {
            const instIds = new Set();
            if (this.defaultInstitutionId) instIds.add(this.defaultInstitutionId);
            insts.forEach(i => instIds.add(i.id));

            if (instIds.size > 0) {
                const stus = await Student.findAll({
                    where: { institution_id: { [Op.in]: Array.from(instIds) }, status: 'active' }
                });
                
                stus.forEach(s => {
                    const fullName = `${s.first_name} ${s.last_name || ''}`.trim().toLowerCase();
                    const key = `${s.institution_id}_${fullName}`;
                    if (!this.students.has(key)) this.students.set(key, []);
                    this.students.get(key).push(s);
                });
            }
        }
    }

    _buildMap(entities, map, nameField) {
        entities.forEach(entity => {
            const key = entity[nameField].toLowerCase();
            if (!map.has(key)) {
                map.set(key, []);
            }
            map.get(key).push(entity);
        });
    }

    resolveInstitution(name, rowNum, errorBuilder) {
        if (!name) {
            if (this.defaultInstitutionId) {
                const def = this.institutions.get(this.defaultInstitutionId.toString());
                if (def && def.length === 1) return def[0];
                return { id: this.defaultInstitutionId }; 
            }
            errorBuilder.addRowError(rowNum, 'Institution is required but missing.');
            return null;
        }

        const key = name.toLowerCase();
        const matches = this.institutions.get(key) || [];
        
        if (matches.length === 0) {
            errorBuilder.addRowError(rowNum, `Active institution '${name}' not found.`);
            return null;
        }
        if (matches.length > 1) {
            errorBuilder.addRowError(rowNum, `Multiple institutions found with the name '${name}'. Please resolve ambiguity.`);
            return null;
        }
        return matches[0];
    }

    resolveCourse(name, rowNum, errorBuilder) {
        if (!name) {
            errorBuilder.addRowError(rowNum, 'Course is required.');
            return null;
        }

        const key = name.toLowerCase();
        const matches = this.courses.get(key) || [];
        
        if (matches.length === 0) {
            errorBuilder.addRowError(rowNum, `Active course '${name}' not found.`);
            return null;
        }
        if (matches.length > 1) {
            errorBuilder.addRowError(rowNum, `Multiple courses found with the name '${name}'. Please resolve ambiguity.`);
            return null;
        }
        return matches[0];
    }

    resolveInstructor(name, rowNum, errorBuilder) {
        if (!name) return null;

        const key = name.toLowerCase();
        const matches = this.instructors.get(key) || [];
        
        if (matches.length === 0) {
            errorBuilder.addRowError(rowNum, `Active instructor '${name}' not found.`);
            return null;
        }
        if (matches.length > 1) {
            errorBuilder.addRowError(rowNum, `Multiple instructors found with the name '${name}'. Please resolve ambiguity.`);
            return null;
        }
        return matches[0];
    }

    resolveStudents(namesString, institutionId, rowNum, errorBuilder) {
        if (!namesString || !institutionId) return [];

        const names = namesString.split(',').map(n => n.trim()).filter(n => n);
        const resolvedStudents = [];

        for (const name of names) {
            const key = `${institutionId}_${name.toLowerCase()}`;
            const matches = this.students.get(key) || [];

            if (matches.length === 0) {
                errorBuilder.addRowError(rowNum, `Active student '${name}' not found in this institution.`);
            } else if (matches.length > 1) {
                errorBuilder.addRowError(rowNum, `Multiple students found with the name '${name}' in this institution. Please resolve ambiguity.`);
            } else {
                resolvedStudents.push(matches[0]);
            }
        }
        return resolvedStudents;
    }
}

module.exports = EntityResolver;
