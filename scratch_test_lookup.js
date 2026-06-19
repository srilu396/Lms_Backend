const institutionService = require('./src/services/institution.service');

async function test() {
    try {
        const result = await institutionService.getInstitutionLookup({ search: 'abc' });
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error(e);
    }
}

test();
