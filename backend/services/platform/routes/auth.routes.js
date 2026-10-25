const { Router } = require('express')
const Joi = require('joi')
const { signAccessToken } = require('../shared/auth.js')
const { validate } = require('../shared/validate.js')

const tokenRequest = Joi.object({
    // There are no users. The label only shows up as the token's 'sub' claim.
    label: Joi.string().trim().min(1).max(40).default('demo'),
})

/**
 * POST /auth/token — hands out an access token without a login.
 * Only mounted when DEV_TOKEN_ENDPOINT=true. In a real system tokens come from an identity provider.
 * @param {{secret: Uint8Array, expiresIn: string}} authConfig
 */
function buildAuthRouter(authConfig) {
    const router = Router()
    router.post('/auth/token', validate({ body: tokenRequest }), async (req, res) => {
        const accessToken = await signAccessToken(authConfig, req.valid.body.label)
        res.status(201).json({ access_token: accessToken, token_type: 'Bearer', expires_in: authConfig.expiresIn })
    })
    return router
}

module.exports = { buildAuthRouter }
