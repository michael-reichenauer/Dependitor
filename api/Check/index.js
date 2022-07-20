const auth = require('../shared/auth.js');

module.exports = async function (context, req) {
    try {
        auth.verifyApiKey(context)

        await auth.check(context, req.body)

        context.res = { status: 200, body: '' };
    } catch (err) {
        context.log.error('error:', err.message);
        context.res = { status: 400, body: `error: '${err.message}'` };
    }
}