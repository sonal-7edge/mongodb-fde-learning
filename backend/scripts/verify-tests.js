// Guards the attendee exercise tests: they must not be edited to make them pass.
// test/exercises/checksums.json holds a SHA-256 for every exercise test file.
// Usage: node scripts/verify-tests.js            (check; run by `make test`)
//        node scripts/verify-tests.js --update   (maintainers only: record new checksums)
const { createHash } = require('node:crypto')
const { readFileSync, readdirSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const EXERCISE_DIR = 'test/exercises'
const MANIFEST = join(EXERCISE_DIR, 'checksums.json')

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const testFiles = readdirSync(EXERCISE_DIR).filter((name) => name.endsWith('.test.js')).sort()

if (process.argv.includes('--update')) {
    const manifest = Object.fromEntries(testFiles.map((name) => [name, sha256(join(EXERCISE_DIR, name))]))
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
    console.log(`Recorded checksums for ${testFiles.length} exercise test file(s).`)
    process.exit(0)
}

const expected = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const problems = []
for (const name of Object.keys(expected)) {
    if (!testFiles.includes(name)) problems.push(`${name} is missing`)
    else if (sha256(join(EXERCISE_DIR, name)) !== expected[name]) problems.push(`${name} has been edited`)
}
for (const name of testFiles) {
    if (!(name in expected)) problems.push(`${name} is not in the checksum list`)
}

if (problems.length > 0) {
    console.error('❌ Exercise tests must stay exactly as provided:')
    for (const problem of problems) console.error(`   - ${problem}`)
    console.error('   Change the application code to make them pass, not the tests.')
    console.error(`   To restore them: git checkout -- ${EXERCISE_DIR}`)
    process.exit(1)
}
console.log(`✅ ${Object.keys(expected).length} exercise test file(s) unchanged.`)
