'use strict';

const crypto = require('crypto');

const generateUniqueCode = (prefix) => {
    return `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = [
      { name: 'batches', prefix: 'BCH' },
      { name: 'institutions', prefix: 'INS' },
      { name: 'courses', prefix: 'CRS' },
      { name: 'tutors', prefix: 'TUT' },
      { name: 'students', prefix: 'STU' }
    ];

    for (const table of tables) {
      // 1. Add column
      await queryInterface.addColumn(table.name, 'unique_code', {
        type: Sequelize.STRING,
        allowNull: true,
      });

      // 2. Fetch all rows
      const rows = await queryInterface.sequelize.query(
        `SELECT id FROM ${table.name};`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      // 3. Update each row with a unique code
      for (const row of rows) {
        let unique = false;
        let code = '';
        while(!unique) {
          code = generateUniqueCode(table.prefix);
          const existing = await queryInterface.sequelize.query(
            `SELECT id FROM ${table.name} WHERE unique_code = :code;`,
            { 
              replacements: { code },
              type: Sequelize.QueryTypes.SELECT 
            }
          );
          if (existing.length === 0) unique = true;
        }

        await queryInterface.sequelize.query(
          `UPDATE ${table.name} SET unique_code = :code WHERE id = :id;`,
          { 
            replacements: { code, id: row.id } 
          }
        );
      }

      // 4. Add unique constraint
      await queryInterface.addConstraint(table.name, {
        fields: ['unique_code'],
        type: 'unique',
        name: `${table.name}_unique_code_key`
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tables = ['batches', 'institutions', 'courses', 'tutors', 'students'];
    for (const table of tables) {
      await queryInterface.removeColumn(table, 'unique_code');
    }
  }
};
