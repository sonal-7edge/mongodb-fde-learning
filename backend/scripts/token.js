// Prints a signed access token for curl.
// Usage:  TOKEN=$(make -s token)
//         curl -H "Authorization: Bearer $TOKEN" localhost:3000/api/admin/overview
const { loadAuthConfig, signAccessToken } = require('../shared/auth.js')

try {
    process.loadEnvFile()
} catch {
    // no .env: use the environment as it is
}

async function main() {
    const label = process.argv[2] ?? 'curl'
    console.log(await signAccessToken(loadAuthConfig(process.env), label))
}

main().catch((error) => {
    console.error(`❌ ${error.message}`)
    process.exit(1)
})
