const auth = require('../shared/auth.js');

module.exports = async function (context, req) {
    try {
        auth.verifyApiKey(context)
        const response = await auth.getWebAuthnAuthenticationOptions(context, req.body)

        context.res = { status: 200, body: response };
    } catch (err) {
        // context.log.error('error:', err.message);
        context.res = { status: 400, body: `error: '${err.message}'` };

    }
}